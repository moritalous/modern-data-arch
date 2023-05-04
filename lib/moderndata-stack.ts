import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

import * as iam from 'aws-cdk-lib/aws-iam';

import { RearcCovid19DataSyncStack } from './data-collect/rearc-covid-19-world-cases-deaths-testing/datasync-stack';
import { StaticDatasetDataSyncStack } from './data-collect/static-datasets/datasync-stack';
import { RedshiftStack } from './data-process/redshift-stack';
import { AuditManagerStack } from './extra/audit-manager-stack';
import { AthenaStack } from './foundation/athena-stack';
import { BackupStack } from './foundation/backup-stack';
import { BucketStack } from './foundation/bucket-stack';
import { GlueStack } from './foundation/glue-stack';
import { IamStack } from './foundation/iam-stack';
import { KmsStack } from './foundation/kms-stack';

export class ModerndataStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'ModerndataQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    const cFNExecRoleName = new cdk.CfnParameter(this, 'CFNExecRoleOrUserArnParam', {
      type: 'String',
      description: 'Enter the Role Name',
      default: 'OrganizationAccountAccessRole'
    })

    // const defaultPassword = new cdk.CfnParameter(this, 'DefaultPassword', {
    //   type: 'String',
    //   description: 'Default password for services and IAM users. This approach is not recommended outside of this workshop. This value needs to be greater 8 or more characters long, and contain numbers, symbols, upper case and lower case letters. The following characters cannot be used: \\, @, ?, / and spaces.',
    //   default: 'Admin123$',
    //   noEcho: true
    // })

    const regionMap = new cdk.CfnMapping(this, 'RegionMap', {
      mapping: {
        'us-east-2': {
          'name': '-ohio'
        },
        'us-east-1': {
          'name': '-virginia'
        },
        'us-west-1': {
          'name': '-cali'
        },
        'us-west-2': {
          'name': '-oregon'
        },
        'ap-northeast-2': {
          'name': '-seoul'
        },
        'ap-southeast-1': {
          'name': '-singapore'
        },
        'ap-southeast-2': {
          'name': '-sydney'
        },
        'ap-northeast-1': {
          'name': '-tokyo'
        },
        'eu-central-1': {
          'name': '-frankfurt'
        },
        'eu-west-1': {
          'name': '-ireland'
        },
        'eu-west-2': {
          'name': '-london'
        }
      }
    })

    ///
    const cFNExecRoleOrUserArnParam = iam.Role.fromRoleName(this, 'cFNExecRoleName', 'OrganizationAccountAccessRole').roleArn

    const bucketNameParam = '-lakehouse-datalake'

    const kmsStack = new KmsStack(this, 'KmsStack',
      cFNExecRoleOrUserArnParam,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      });

    const bucketStack = new BucketStack(this, 'bucketStack',
      regionMap,
      bucketNameParam,
      kmsStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const backupStack = new BackupStack(this, 'backupStack',
      bucketStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const athenaStack = new AthenaStack(this, 'athenaStack',
      regionMap,
      kmsStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const glueStack = new GlueStack(this, 'glueStack',
      cFNExecRoleOrUserArnParam,
      kmsStack,
      bucketStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const iamStack = new IamStack(this, 'iamStack',
      kmsStack,
      bucketStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const dataCollect1Stack = new RearcCovid19DataSyncStack(this, 'dataCollect1Stack',
      kmsStack,
      bucketStack,
      {})

    const dataCollect2Stack = new StaticDatasetDataSyncStack(this, 'dataCollect2Stack',
      kmsStack,
      bucketStack,
      {})

    const auditManagerStack = new AuditManagerStack(this, 'auditManagerStack',
      regionMap,
      cFNExecRoleOrUserArnParam,
      kmsStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })

    const redshiftStack = new RedshiftStack(this, 'redshiftStack',
      kmsStack,
      {
        env: { region: 'us-east-1' },
        crossRegionReferences: true,
      })
  }
}
