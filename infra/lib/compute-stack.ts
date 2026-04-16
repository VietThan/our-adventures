import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class ComputeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------------------------
    // Read shared infra outputs from SSM
    // -------------------------------------------------------------------------
    // These parameters are written by shared-aws-infra (already deployed).
    // valueFromLookup resolves at synth time via a context provider — CDK calls
    // SSM and caches the result in cdk.context.json. Subsequent synths use
    // the cached value without making an API call.
    const vpcId       = ssm.StringParameter.valueFromLookup(this, '/shared/network/vpc-id');
    const appTierSgId = ssm.StringParameter.valueFromLookup(this, '/shared/network/app-tier-sg-id');
    const oidcArn     = ssm.StringParameter.valueFromLookup(this, '/shared/iam/github-oidc-provider-arn');

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
      // Public IP changes on stop/start. Update the Cloudflare DNS A record
      // if the instance is ever stopped and restarted.
      associatePublicIpAddress: true,
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
      '# App user — deploys run as this user, not root or ec2-user',
      'useradd -m -s /bin/bash deploy',
      'mkdir -p /home/deploy/app /home/deploy/migrations',
      'chown -R deploy:deploy /home/deploy/app /home/deploy/migrations',
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
      '# nginx config — HTTP only; Certbot adds the HTTPS server block later.',
      '# Variables like $http_upgrade are nginx variables, not shell variables,',
      '# so this heredoc must use a quoted delimiter to prevent shell expansion.',
      'cat > /etc/nginx/conf.d/our-adventures.conf << \'NGINXEOF\'',
      'server {',
      '    listen 80;',
      '    server_name adventures.sleepyshortcake.com;',
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
    );

    // -------------------------------------------------------------------------
    // GitHub Actions IAM role (OIDC) — used by deploy-infra.yml only
    // -------------------------------------------------------------------------
    // Mirrors the GitHubActions-SharedInfra pattern in shared-aws-infra exactly,
    // scoped to this repo's main branch.
    //
    // Note: oidcArn comes from valueFromLookup — it resolves to the real ARN
    // after the first cdk synth populates cdk.context.json. If cdk synth shows
    // a dummy value in the trust policy, run it once to populate the context
    // and then run cdk deploy.
    const ghaRole = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'GitHubActions-OurAdventures',
      assumedBy: new iam.WebIdentityPrincipal(oidcArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub':
            'repo:VietThan/our-adventures:ref:refs/heads/main',
        },
      }),
    });

    // Only permission: assume CDK bootstrap roles. CDK bootstrap roles do the
    // actual CloudFormation work — this role just hands off to them.
    ghaRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['sts:AssumeRole'],
      resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
    }));

    // -------------------------------------------------------------------------
    // SSM export — EC2 public IP
    // -------------------------------------------------------------------------
    // Written after deploy so deploy-app.yml can read the current IP dynamically
    // instead of hardcoding it. Update the Cloudflare DNS A record to match
    // whenever the instance is stopped and restarted.
    new ssm.StringParameter(this, 'AppServerIp', {
      parameterName: '/our-adventures/ec2/public-ip',
      stringValue: instance.instancePublicIp,
      description: 'our-adventures EC2 public IP - changes on stop/start',
    });
  }
}
