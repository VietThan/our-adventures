import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Deploy SSH public key — passed via --context deployKeyPublic="..." at synth time.
    // Set DEPLOY_KEY_PUBLIC as a GitHub Actions variable and pass it in deploy-infra.yml.
    const deployKeyPublic = this.node.getContext('deployKeyPublic') as string;

    // -------------------------------------------------------------------------
    // Read shared infra outputs from SSM
    // -------------------------------------------------------------------------
    // These parameters are written by shared-aws-infra (already deployed).
    // valueFromLookup resolves at synth time via a context provider — CDK calls
    // SSM and caches the result in cdk.context.json. Subsequent synths use
    // the cached value without making an API call.
    const vpcId       = ssm.StringParameter.valueFromLookup(this, '/shared/network/vpc-id');
    const appTierSgId = ssm.StringParameter.valueFromLookup(this, '/shared/network/app-tier-sg-id');

    // -------------------------------------------------------------------------
    // Import shared VPC and app-tier security group by ID
    // -------------------------------------------------------------------------
    // We do not own these — just import them so CDK can reference them.
    const vpc = ec2.Vpc.fromLookup(this, 'SharedVpc', { vpcId });

    // app-tier-sg is attached to every app EC2. The RDS security group allows
    // port 5432 from any resource carrying this SG — no RDS rule changes needed
    // when new apps are added.
    const appTierSg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'AppTierSg',
      appTierSgId,
      { allowAllOutbound: true },
    );

    // -------------------------------------------------------------------------
    // EC2 security group
    // -------------------------------------------------------------------------
    const ec2Sg = new ec2.SecurityGroup(this, 'Ec2Sg', {
      vpc,
      description: 'our-adventures EC2 - HTTP, HTTPS, SSH',
      allowAllOutbound: true,
    });

    // SSH from anywhere — access is controlled by the ed25519 deploy key,
    // not by IP. GitHub Actions IPs are dynamic so we cannot restrict by IP.
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22),  'SSH from anywhere (GHA deploy key)');

    // Port 80: Let's Encrypt HTTP-01 challenge + nginx HTTP→HTTPS redirect.
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  'HTTP (Certbot + redirect)');

    // Port 443: HTTPS traffic.
    ec2Sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // -------------------------------------------------------------------------
    // IAM instance role
    // -------------------------------------------------------------------------
    const instanceRole = new iam.Role(this, 'Ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        // Enables SSM Session Manager — ad-hoc SSH alternative, no port 22 required
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    // Read per-app secrets from SSM at deploy time (via the deploy workflow's
    // on-instance env-writing script).
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:GetParameter', 'ssm:GetParameters'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/our-adventures/*`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/shared/db/*`,
      ],
    }));

    // Decrypt SecureString params (Google OAuth creds, DB password, AUTH_SECRET)
    // using the default AWS-managed SSM KMS key.
    instanceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['kms:Decrypt'],
      resources: [`arn:aws:kms:${this.region}:${this.account}:key/alias/aws/ssm`],
    }));

    // -------------------------------------------------------------------------
    // EC2 instance — t4g.nano (ARM/Graviton2) in a public subnet
    // -------------------------------------------------------------------------
    // No NAT Gateway in this VPC (saves ~$32/month). EC2 lives in a public
    // subnet with a public IP so it can reach the internet and be reached by
    // GitHub Actions for SSH deploys.
    const instance = new ec2.Instance(this, 'AppServer', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.NANO),
      // ARM_64 is required for t4g — same chip family as the RDS t4g.micro.
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: ec2Sg,
      role: instanceRole,
      // Public IP changes on stop/start. deploy-app.yml auto-updates the
      // Cloudflare A record on every deploy, so a stop/start is fixed on
      // the next push to main (or a manual workflow_dispatch).
      associatePublicIpAddress: true,
      // User data is provisioning-critical for this single-instance app
      // (deploy user, nginx, RDS CA bundle, Certbot). Replace the instance
      // when user data changes so first-boot setup actually runs.
      userDataCausesReplacement: true,
    });

    // Attach app-tier-sg so the RDS SG allows port 5432 from this instance.
    instance.addSecurityGroup(appTierSg);

    // -------------------------------------------------------------------------
    // User data — runs once on first boot
    // -------------------------------------------------------------------------
    instance.addUserData(
      '#!/bin/bash',
      'set -euxo pipefail',
      '',
      '# Node.js 22 LTS (arm64 via NodeSource)',
      'curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -',
      'dnf install -y nodejs',
      '',
      '# nginx',
      'dnf install -y nginx',
      'systemctl enable nginx',
      '',
      '# PostgreSQL client for running migrations against RDS.',
      '# AL2023 ships postgresql15 in the base repo; that version of psql',
      '# works fine against PostgreSQL 18 on RDS for running .sql files.',
      'dnf install -y postgresql15',
      '',
      '# AWS RDS CA bundle for TLS verification.',
      '# The app and psql use this to verify the RDS server certificate.',
      'curl -fsSL -o /etc/ssl/certs/rds-combined-ca-bundle.pem \\',
      '  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem',
      'chmod 644 /etc/ssl/certs/rds-combined-ca-bundle.pem',
      '',
      '# Certbot + Cloudflare DNS plugin for automated TLS provisioning.',
      '# AL2023 ships Python 3.9 as default, but 3.12 is in the base repo.',
      '# Certbot is dropping 3.9 support — use 3.12 (supported until Oct 2028).',
      'dnf install -y python3.12',
      'python3.12 -m venv /opt/certbot',
      '/opt/certbot/bin/pip install certbot certbot-dns-cloudflare certbot-nginx',
      'ln -sf /opt/certbot/bin/certbot /usr/bin/certbot',
      '',
      '# Pull the Cloudflare API token from SSM and write the credentials file.',
      '# Disable xtrace to avoid leaking the token into cloud-init-output.log.',
      'set +x',
      'CF_TOKEN=$(aws ssm get-parameter \\',
      '  --name /our-adventures/cloudflare/dns-api-token \\',
      '  --with-decryption \\',
      '  --query Parameter.Value \\',
      '  --output text \\',
      '  --region us-east-1)',
      'mkdir -p /etc/letsencrypt',
      "printf 'dns_cloudflare_api_token = %s\\n' \"$CF_TOKEN\" > /etc/letsencrypt/cloudflare.ini",
      'chmod 600 /etc/letsencrypt/cloudflare.ini',
      'unset CF_TOKEN',
      'set -x',
      '',
      '# Provision TLS certificate (non-interactive, DNS-01 challenge).',
      '# DNS-01 does not require the A record to point at this instance —',
      '# it proves ownership via a TXT record. The A record is updated later',
      '# by deploy-app.yml after the app is deployed and running.',
      'certbot certonly \\',
      '  --dns-cloudflare \\',
      '  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \\',
      '  --non-interactive \\',
      '  --agree-tos \\',
      '  --email vietthan@gmail.com \\',
      '  -d adventures.sleepyshortcake.com',
      '',
      '# App user — deploys run as this user, not root or ec2-user',
      'useradd -m -s /bin/bash deploy',
      'mkdir -p /home/deploy/app /home/deploy/migrations /home/deploy/.ssh',
      'chmod 700 /home/deploy/.ssh',
      '',
      '# Deploy SSH authorized key — passed in at synth time via CDK context.',
      '# Public keys are not sensitive; the private key lives in GHA secrets.',
      `echo '${deployKeyPublic}' > /home/deploy/.ssh/authorized_keys`,
      'chmod 600 /home/deploy/.ssh/authorized_keys',
      'chown -R deploy:deploy /home/deploy/app /home/deploy/migrations /home/deploy/.ssh',
      '',
      '# Allow deploy user to restart the web service without a password',
      'echo "deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart web" > /etc/sudoers.d/deploy-web',
      'chmod 440 /etc/sudoers.d/deploy-web',
      '',
      '# Systemd service for the Next.js standalone server',
      'cat > /etc/systemd/system/web.service << \'SERVICEEOF\'',
      '[Unit]',
      'Description=our-adventures Next.js app',
      'After=network.target',
      '',
      '[Service]',
      'Type=simple',
      'User=deploy',
      'WorkingDirectory=/home/deploy/app',
      'EnvironmentFile=/home/deploy/app/.env',
      'Environment=PORT=3000',
      'ExecStart=/usr/bin/node server.js',
      'Restart=always',
      'RestartSec=10',
      'StandardOutput=journal',
      'StandardError=journal',
      '',
      '[Install]',
      'WantedBy=multi-user.target',
      'SERVICEEOF',
      'systemctl daemon-reload',
      '',
      '# nginx config — HTTPS with the Certbot-provisioned certificate.',
      '# Variables like $http_upgrade are nginx variables, not shell variables,',
      '# so this heredoc must use a quoted delimiter to prevent shell expansion.',
      'cat > /etc/nginx/conf.d/our-adventures.conf << \'NGINXEOF\'',
      'server {',
      '    listen 80;',
      '    server_name adventures.sleepyshortcake.com;',
      '    return 301 https://$host$request_uri;',
      '}',
      '',
      'server {',
      '    listen 443 ssl;',
      '    server_name adventures.sleepyshortcake.com;',
      '',
      '    ssl_certificate /etc/letsencrypt/live/adventures.sleepyshortcake.com/fullchain.pem;',
      '    ssl_certificate_key /etc/letsencrypt/live/adventures.sleepyshortcake.com/privkey.pem;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:3000;',
      '        proxy_http_version 1.1;',
      '        proxy_set_header Upgrade $http_upgrade;',
      '        proxy_set_header Connection "upgrade";',
      '        proxy_set_header Host $host;',
      '        proxy_set_header X-Real-IP $remote_addr;',
      '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;',
      '        proxy_set_header X-Forwarded-Proto $scheme;',
      '    }',
      '}',
      'NGINXEOF',
      'systemctl restart nginx',
      '',
      '# Certbot auto-renewal timer',
      'cat > /etc/systemd/system/certbot-renew.timer << \'TIMEREOF\'',
      '[Unit]',
      'Description=Certbot renewal timer',
      '',
      '[Timer]',
      'OnCalendar=*-*-* 02:30:00',
      'RandomizedDelaySec=3600',
      'Persistent=true',
      '',
      '[Install]',
      'WantedBy=timers.target',
      'TIMEREOF',
      '',
      'cat > /etc/systemd/system/certbot-renew.service << \'SVCEOF\'',
      '[Unit]',
      'Description=Certbot renewal',
      '',
      '[Service]',
      'Type=oneshot',
      'ExecStart=/usr/bin/certbot renew --quiet --deploy-hook "systemctl restart nginx"',
      'SVCEOF',
      '',
      'systemctl daemon-reload',
      'systemctl enable certbot-renew.timer',
      'systemctl start certbot-renew.timer',
    );

    // -------------------------------------------------------------------------
    // SSM export — EC2 public IP
    // -------------------------------------------------------------------------
    // Written at deploy time so the new IP can be read from SSM.
    // deploy-app.yml auto-updates the Cloudflare A record on every app deploy.
    new ssm.StringParameter(this, 'AppServerIp', {
      parameterName: '/our-adventures/ec2/public-ip',
      stringValue: instance.instancePublicIp,
      description: 'our-adventures EC2 public IP - changes on stop/start',
    });
  }
}
