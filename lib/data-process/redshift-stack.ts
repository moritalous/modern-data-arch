import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as redshift from 'aws-cdk-lib/aws-redshiftserverless';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

import { KmsStack } from '../foundation/kms-stack';

export class RedshiftStack extends cdk.Stack {

  constructor(scope: Construct, id: string,
    kmsStack: KmsStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const redshiftVpc = new ec2.Vpc(this, 'redshiftVpc', {
      availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: 0
    })

    const redshiftSg = new ec2.SecurityGroup(this, 'redshiftSg', {
      vpc: redshiftVpc
    })

    const redshiftSecret = new secretsmanager.Secret(this, 'redshiftSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        excludeCharacters: '!@#$%^&*()_+-=[]{};:,./<>?|`~'
      }
    })

    function createRedshiftServerless(construct: Construct, id: string,) {

      const redshiftRole = new iam.Role(construct, `redshiftRole-${id}`, {
        roleName: `RedshiftRole-${id}`,
        assumedBy: new iam.CompositePrincipal(
          new iam.ServicePrincipal('redshift.amazonaws.com'),
          new iam.ServicePrincipal('redshift-serverless.amazonaws.com'),
          new iam.ServicePrincipal('sagemaker.amazonaws.com'),
        ),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRedshiftAllCommandsFullAccess')
        ],
        inlinePolicies: {
          'AmazonRedshift-CommandsAccessPolicy': new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  's3:GetObject',
                  's3:GetBucketAcl',
                  's3:GetBucketCors',
                  's3:GetEncryptionConfiguration',
                  's3:GetBucketLocation',
                  's3:ListBucket',
                  's3:ListAllMyBuckets',
                  's3:ListMultipartUploadParts',
                  's3:ListBucketMultipartUploads',
                  's3:PutObject',
                  's3:PutBucketAcl',
                  's3:PutBucketCors',
                  's3:DeleteObject',
                  's3:AbortMultipartUpload',
                  's3:CreateBucket'
                ],
                resources: [
                  'arn:aws:s3:::redshift',
                  'arn:aws:s3:::redshift/*',
                ]
              }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'glue:*',
                  'lakeformation:GetDataAccess'
                ],
                resources: [
                  '*'
                ]
              })
            ]
          })
        }
      })
      kmsStack.key.grantEncryptDecrypt(redshiftRole)

      const redshiftNamespace = new redshift.CfnNamespace(construct, `redshift-namespace${id}`, {
        namespaceName: `namespace-${id}`,
        adminUsername: redshiftSecret.secretValueFromJson('username').unsafeUnwrap(),
        adminUserPassword: redshiftSecret.secretValueFromJson('password').unsafeUnwrap(),
        iamRoles: [
          redshiftRole.roleArn
        ],
        defaultIamRoleArn: redshiftRole.roleArn,
        kmsKeyId: kmsStack.key.keyId,
        logExports: ['userlog', 'connectionlog', 'useractivitylog'],
      })
      redshiftNamespace.node.addDependency(redshiftVpc)
      redshiftNamespace.node.addDependency(redshiftRole)

      const redshiftWorkGroup = new redshift.CfnWorkgroup(construct, `redshift-workgroup${id}`, {
        workgroupName: `workgroup-${id}`,
        namespaceName: redshiftNamespace.namespaceName,
        securityGroupIds: [redshiftSg.securityGroupId],
        subnetIds: redshiftVpc.isolatedSubnets.map(s => s.subnetId),
        baseCapacity: 8
      })
      redshiftWorkGroup.node.addDependency(redshiftNamespace)
    }

    createRedshiftServerless(this, 'ja')
    createRedshiftServerless(this, 'us')
    createRedshiftServerless(this, 'eu')
  }
}
