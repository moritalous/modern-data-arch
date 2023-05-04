import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as s3 from 'aws-cdk-lib/aws-s3'

import { KmsStack } from './kms-stack';

export class BucketStack extends cdk.Stack {

  public readonly s3BucketRaw: s3.IBucket;
  public readonly s3BucketStage: s3.IBucket;

  constructor(scope: Construct, id: string,
    regionMap: cdk.CfnMapping,
    bucketNameParam: string,
    kmsStack: KmsStack,
    props?: cdk.StackProps) {

    super(scope, id, props);


    this.s3BucketRaw = new s3.Bucket(this, 's3BucketRaw', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsStack.key,
      bucketName: `${this.account}${regionMap.findInMap(this.region, 'name')}${bucketNameParam}-raw`,
      versioned: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(2),
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(1),
            }
          ]
        }
      ]
    })

    this.s3BucketStage = new s3.Bucket(this, 's3BucketStage', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsStack.key,
      bucketName: `${this.account}${regionMap.findInMap(this.region, 'name')}${bucketNameParam}-stage`,
      versioned: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(2),
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(1),
            }
          ]
        }
      ]
    })

  }
}
