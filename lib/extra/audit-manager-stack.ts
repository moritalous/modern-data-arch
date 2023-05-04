import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as auditmanager from 'aws-cdk-lib/aws-auditmanager';
import * as s3 from 'aws-cdk-lib/aws-s3';

import { KmsStack } from '../foundation/kms-stack';

export class AuditManagerStack extends cdk.Stack {

  constructor(scope: Construct, id: string,
    regionMap: cdk.CfnMapping,
    cFNExecRoleOrUserArnParam: string,
    kmsStack: KmsStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const s3BucketAudit = new s3.Bucket(this, 's3BucketAudit', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsStack.key,
      bucketName: `${this.account}${regionMap.findInMap(this.region, 'name')}-audit`,
      versioned: true,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
          noncurrentVersionTransitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(7),
            }
          ]
        }
      ]
    })

    new auditmanager.CfnAssessment(this, 'assesment', {
      name: 'assesment',
      assessmentReportsDestination: {
        destinationType: 'S3',
        destination: s3BucketAudit.s3UrlForObject(),
      },
      frameworkId: '9e1c5fea-7cb7-3131-b395-7fe9f1d0f2f1',
      awsAccount: {
        id: this.account,
      },
      scope: {
        awsAccounts: [
          { id: this.account }
        ],
        awsServices: [
          { serviceName: 'config' },
          { serviceName: 'iam' },
          { serviceName: 'cloudtrail' },
        ]
      },
      roles: [
        {
          roleType: 'PROCESS_OWNER',
          roleArn: cFNExecRoleOrUserArnParam
        }
      ]
    })

  }
}
