import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';

export class KmsStack extends cdk.Stack {

  public readonly key: kms.Key

  constructor(scope: Construct, id: string,
    cFNExecRoleOrUserArnParam: string,
    props?: cdk.StackProps) {
    super(scope, id, props);

    this.key = new kms.Key(this, 'LakeEncryptionKey', {
      description: 'The key we will use to encrypt data',
      enableKeyRotation: true,
      admins: [
        new iam.ArnPrincipal(cFNExecRoleOrUserArnParam)
      ],
    })

    const lakeKeyAlias = new kms.Alias(this, 'LakeKeyAlias', {
      aliasName: 'alias/CustomLakeEncryptionKey',
      targetKey: this.key
    })
  }
}
