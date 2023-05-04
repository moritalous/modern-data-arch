import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as backup from 'aws-cdk-lib/aws-backup';
import * as iam from 'aws-cdk-lib/aws-iam';

import { BucketStack } from './bucket-stack';

export class BackupStack extends cdk.Stack {

  constructor(scope: Construct, id: string,
    bucketStack: BucketStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const backupPlan = backup.BackupPlan.daily35DayRetention(this, 'BackupPlan')
    backupPlan.addSelection('backupSelection', {
      resources: [
        backup.BackupResource.fromArn(bucketStack.s3BucketRaw.bucketArn),
        backup.BackupResource.fromArn(bucketStack.s3BucketStage.bucketArn),
      ],
      role: new iam.Role(this, 'backupSelectionRole', {
        assumedBy: new iam.ServicePrincipal('backup.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSBackupServiceRolePolicyForBackup'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccess'),
          iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchEventsFullAccess'),
        ],
      })
    })

  }
}
