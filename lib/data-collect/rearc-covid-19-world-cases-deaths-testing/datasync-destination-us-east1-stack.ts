import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as datasync from 'aws-cdk-lib/aws-datasync';
import * as iam from 'aws-cdk-lib/aws-iam';

import { BucketStack } from '../../foundation/bucket-stack';
import { KmsStack } from '../../foundation/kms-stack';

export class DataSyncDestinationUsEast1 extends cdk.Stack {

  public readonly datasyncDestinationLocationArn: string

  constructor(scope: Construct, id: string,
    kmsStack: KmsStack,
    bucketStack: BucketStack,

    props?: cdk.StackProps) {

    super(scope, id, props);

    const datasyncDestinationRole = new iam.Role(this, 'datasyncDestinationRole', {
      assumedBy: new iam.ServicePrincipal('datasync.amazonaws.com'),
      inlinePolicies: {
        datasyncDestinationPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                's3:GetBucketLocation',
                's3:ListBucket',
                's3:ListBucketMultipartUploads'
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `${bucketStack.s3BucketRaw.bucketArn}`,
              ]
            }),
            new iam.PolicyStatement({
              actions: [
                's3:AbortMultipartUpload',
                's3:DeleteObject',
                's3:GetObject',
                's3:ListMultipartUploadParts',
                's3:PutObject',
                's3:GetObjectTagging',
                's3:PutObjectTagging'
              ],
              effect: iam.Effect.ALLOW,
              resources: [
                `${bucketStack.s3BucketRaw.bucketArn}/*`,
              ]
            }),
          ]
        })
      }
    })
    kmsStack.key.grantEncryptDecrypt(datasyncDestinationRole)

    const datasyncDestinationLocation = new datasync.CfnLocationS3(this, 'datasycDestinationLocation', {
      s3BucketArn: bucketStack.s3BucketRaw.bucketArn,
      s3Config: {
        bucketAccessRoleArn: datasyncDestinationRole.roleArn,
      },
      subdirectory: '/rearc-covid-19-world-cases-deaths-testing/json/'
    })
    datasyncDestinationLocation.node.addDependency(datasyncDestinationRole)

    this.datasyncDestinationLocationArn = datasyncDestinationLocation.attrLocationArn

  }
}