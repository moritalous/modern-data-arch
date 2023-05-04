import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as datasync from 'aws-cdk-lib/aws-datasync';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatchlogs from 'aws-cdk-lib/aws-logs';

export class DataSyncSourceUsEast2 extends cdk.Stack {

  constructor(scope: Construct, id: string,
    datasyncDestinationLocationArn: string,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const datasyncSourceRole = new iam.Role(this, 'datasyncSourceRole', {
      assumedBy: new iam.ServicePrincipal('datasync.amazonaws.com'),
      inlinePolicies: {
        datasyncSourcePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                's3:GetBucketLocation',
                's3:ListBucket',
                's3:ListBucketMultipartUploads'
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `arn:aws:s3:::covid19-lake`
              ]
            }),
            new iam.PolicyStatement({
              actions: [
                's3:List*',
                's3:Get*',
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `arn:aws:s3:::covid19-lake/*`
              ]
            }),
          ]

        })
      }
    })

    const datasycSourceLocation = new datasync.CfnLocationS3(this, 'datasycSourceLocation', {
      s3BucketArn: 'arn:aws:s3:::covid19-lake',
      s3Config: {
        bucketAccessRoleArn: datasyncSourceRole.roleArn,
      },
      subdirectory: '/static-datasets/csv/countrycode/'
    })

    const trustDataSyncPolicy = new cloudwatchlogs.ResourcePolicy(this, 'trustDataSync', {
      policyStatements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:PutLogEvents',
            'logs:CreateLogStream'
          ],
          principals: [
            new iam.ServicePrincipal('datasync.amazonaws.com')
          ],
          conditions: {
            'ArnLike': {
              'aws:SourceArn': [`arn:aws:datasync:${this.region}:${this.account}:task/*`]
            },
            'StringEquals': {
              'aws:SourceAccount': this.account
            }
          },
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:log-group:*:*`
          ]
        })
      ]
    })

    const datasyncTask = new datasync.CfnTask(this, 'datasyncTask', {
      sourceLocationArn: datasycSourceLocation.attrLocationArn,
      destinationLocationArn: datasyncDestinationLocationArn,
      cloudWatchLogGroupArn: new cloudwatchlogs.LogGroup(this, 'datasyncLogGroup', {
      }).logGroupArn,
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)'
      },
      options: {
        logLevel: 'TRANSFER',
        verifyMode: 'NONE',
        objectTags: 'NONE'
      }
    })
  }
}