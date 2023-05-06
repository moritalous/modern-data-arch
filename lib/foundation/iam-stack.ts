import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';

import { BucketStack } from './bucket-stack';
import { KmsStack } from './kms-stack';

export class IamStack extends cdk.Stack {

  constructor(scope: Construct, id: string,
    kmsStack: KmsStack,
    bucketStack: BucketStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const sitewiseRole = new iam.Role(this, 'sitewiseRole', {
      assumedBy: new iam.ServicePrincipal('iotsitewise.amazonaws.com'),
      roleName: 'sitewise-storage-role',
      inlinePolicies: {
        'AmazonS3BucketAllowPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:ListBucket',
                's3:PutObject',
                's3:GetObject',
                's3:DeleteObject',
                's3:GetBucketLocation'
              ],
              resources: [
                `${bucketStack.s3BucketRaw.bucketArn}`,
                `${bucketStack.s3BucketRaw.bucketArn}/*`,
              ]
            })
          ]
        })
      }
    })
    kmsStack.key.grantEncryptDecrypt(sitewiseRole)

    function createAnalystRoleProps(
      id: string,
      env: { region: string, account: string }
    ) {
      return {
        assumedBy: new iam.CompositePrincipal(
          new iam.AccountRootPrincipal(),
        ),
        roleName: `analyst-${id}-role`,
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRedshiftQueryEditorV2NoSharing'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAthenaFullAccess'),
        ],
        inlinePolicies: {
          [`Analyst-${id}-Policy`]: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'sqlworkbench:CreateAccount',
                ],
                resources: ['*']
              }),
              // new iam.PolicyStatement({
              //   effect: iam.Effect.ALLOW,
              //   actions: [
              //     'redshift-serverless:GetNamespace',
              //     'redshift-serverless:GetWorkgroup',
              //   ],
              //   resources: [
              //     `arn:aws:redshift-serverless:${env.region}:${env.account}:workgroup/workgroup-${id}`,
              //     `arn:aws:redshift-serverless:${env.region}:${env.account}:namespace/namespace-${id}`
              //   ]
              // }),
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'redshift-serverless:*',
                ],
                resources: ['*']
              }),

              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'lakeformation:StartQueryPlanning',
                  'lakeformation:GetQueryState',
                  'lakeformation:GetWorkUnits',
                  'lakeformation:GetWorkUnitResults',
                  'lakeformation:GetQueryStatistics',
                  'lakeformation:StartTransaction',
                  'lakeformation:CommitTransaction',
                  'lakeformation:CancelTransaction',
                  'lakeformation:ExtendTransaction',
                  'lakeformation:DescribeTransaction',
                  'lakeformation:ListTransactions',
                  'lakeformation:GetTableObjects',
                  'lakeformation:UpdateTableObjects',
                  'lakeformation:DeleteObjectsOnCancel'
                ],
                resources: ['*']
              })
            ],
          })
        }
      }
    }

    const analystJpRole = new iam.Role(this, 'analystJpRole',
      createAnalystRoleProps('ja', { region: this.region, account: this.account }))
    kmsStack.key.grantEncryptDecrypt(analystJpRole)

    const analystUsRole = new iam.Role(this, 'analystUsRole',
      createAnalystRoleProps('us', { region: this.region, account: this.account }))
    kmsStack.key.grantEncryptDecrypt(analystUsRole)

    const analystEuRole = new iam.Role(this, 'analystEuRole',
      createAnalystRoleProps('eu', { region: this.region, account: this.account }))
    kmsStack.key.grantEncryptDecrypt(analystEuRole)

  }
}

