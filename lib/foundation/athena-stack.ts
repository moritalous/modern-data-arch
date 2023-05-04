import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as athena from 'aws-cdk-lib/aws-athena';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { KmsStack } from './kms-stack';

export class AthenaStack extends cdk.Stack {

  constructor(scope: Construct, id: string,
    regionMap: cdk.CfnMapping,
    kmsStack: KmsStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const athenaBucket = new s3.Bucket(this, 'AthenaBucket', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsStack.key,
      bucketName: `aws-athena-query-results-${this.account}${regionMap.findInMap(this.region, 'name')}`,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(1)
        }
      ]
    })

    // const athenaSpillBucket = new s3.Bucket(this, 'AthenaSpillBucket', {
    //   accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
    //   blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    //   encryption: s3.BucketEncryption.KMS,
    //   encryptionKey: kmsStack.key,
    //   bucketName: `${this.account}${regionMap.findInMap(this.region, 'name')}-athenaspill`,
    //   lifecycleRules: [
    //     {
    //       expiration: cdk.Duration.days(1)
    //     }
    //   ]
    // })

    const athenaWorkgroup = new athena.CfnWorkGroup(this, 'AthenaWorkgroup', {
      name: 'LakeFormationWorkGroup',
      description: 'A workgroup for Lake Formation',
      recursiveDeleteOption: true,
      state: 'ENABLED',
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        requesterPaysEnabled: false,
        resultConfiguration: {
          encryptionConfiguration: {
            encryptionOption: 'SSE_KMS',
            kmsKey: kmsStack.key.keyArn
          },
          outputLocation: `s3://${athenaBucket.bucketName}/`
        },
      }

    })
    athenaWorkgroup.node.addDependency(athenaBucket)

  }
}
