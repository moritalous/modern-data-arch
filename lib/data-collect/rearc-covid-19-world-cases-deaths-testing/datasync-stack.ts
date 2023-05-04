import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { BucketStack } from '../../foundation/bucket-stack';
import { KmsStack } from '../../foundation/kms-stack';
import { DataSyncDestinationUsEast1 } from './datasync-destination-us-east1-stack';
import { DataSyncSourceUsEast2 } from './datasync-source-us-east2-stack';

export class RearcCovid19DataSyncStack extends cdk.Stack {
  constructor(scope: Construct, id: string,
    kmsStack: KmsStack,
    bucketStack: BucketStack,
    props?: cdk.StackProps) {
    super(scope, id, props);

    const dataSyncDestination = new DataSyncDestinationUsEast1(this, 'dataSyncDestination',
      kmsStack,
      bucketStack,
      {
        env: {
          region: 'us-east-1'
        },
        crossRegionReferences: true,
      })

    const dataSyncSource = new DataSyncSourceUsEast2(this, 'dataSyncSource',
      dataSyncDestination.datasyncDestinationLocationArn,
      {
        env: {
          region: 'us-east-2'
        },
        crossRegionReferences: true,
      })

  }
}
