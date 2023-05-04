import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lakeformation from 'aws-cdk-lib/aws-lakeformation';

import { BucketStack } from './bucket-stack';
import { KmsStack } from './kms-stack';

export class GlueStack extends cdk.Stack {
  constructor(scope: Construct, id: string,
    cFNExecRoleOrUserArnParam: string,
    kmsStack: KmsStack,
    bucketStack: BucketStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    const lakehouseGlueRole = new iam.Role(this, 'LakehouseGlueRole', {
      roleName: 'GlueExecutionRole',
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('glue.amazonaws.com'),
        new iam.ServicePrincipal('lakeformation.amazonaws.com'),
      ),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
      ],
      inlinePolicies: {
        'CustomGluePolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'logs:CreateLogStream',
                'logs:AssociateKmsKey',
                'logs:PutLogEvents'
              ],
              resources: [
                'arn:aws:s3:::aws-glue-*',
                `arn:aws:kms:*:${this.account}:key/*`,
                'arn:aws:logs:*:*:/aws-glue/*',
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lakeformation:GetDataAccess',
              ],
              resources: [
                '*',
              ]
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                's3:PutObject',
                's3:GetObject',
                's3:DeleteObject'
              ],
              resources: [
                `${bucketStack.s3BucketRaw.bucketArn}`,
                `${bucketStack.s3BucketRaw.bucketArn}/*`,
                `${bucketStack.s3BucketStage.bucketArn}`,
                `${bucketStack.s3BucketStage.bucketArn}/*`,
              ]
            })
          ]
        }),
        'LakeFormationTransactionsPolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'lakeformation:StartTransaction',
                'lakeformation:CommitTransaction',
                'lakeformation:CancelTransaction',
                'lakeformation:ExtendTransaction',
                'lakeformation:DescribeTransaction',
                'lakeformation:ListTransactions',
                'lakeformation:StartQueryPlanning',
                'lakeformation:GetQueryState',
                'lakeformation:GetWorkUnitResults',
                'lakeformation:GetWorkUnits',
                'lakeformation:GetQueryStatistics',
                'lakeformation:GetTableObjects',
                'lakeformation:UpdateTableObjects',
                'lakeformation:DeleteObjectsOnCancel'
              ],
              resources: ['*']
            })
          ]
        }),
        'PassrolePolicy': new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'iam:PassRole'
              ],
              resources: ['*']
            })
          ]
        })
      }
    })
    kmsStack.key.grantEncryptDecrypt(lakehouseGlueRole)

    const dataLakeSettings = new lakeformation.CfnDataLakeSettings(this, 'DataLakeSettings', {
      admins: [
        { dataLakePrincipalIdentifier: cFNExecRoleOrUserArnParam },
        { dataLakePrincipalIdentifier: `arn:aws:iam::${this.account}:role/cdk-hnb659fds-cfn-exec-role-${this.account}-${this.region}` },
      ],
    })

    kmsStack.key.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'kms:Encrypt',
          'kms:Decrypt',
          'kms:ReEncrypt*',
          'kms:GenerateDataKey*',
          'kms:DescribeKey',
        ],
        principals: [
          new iam.ArnPrincipal(`arn:aws:iam::${this.account}:role/aws-service-role/lakeformation.amazonaws.com/AWSServiceRoleForLakeFormationDataAccess`),
        ],
        resources: ['*']
      })
    )


    const rawGlueDatabase = new glue.CfnDatabase(this, 'RawGlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'raw',
        description: 'Datalake Raw Database',
        locationUri: bucketStack.s3BucketRaw.s3UrlForObject()
      }
    })
    rawGlueDatabase.node.addDependency(dataLakeSettings)

    const stageGlueDatabase = new glue.CfnDatabase(this, 'StageGlueDatabase', {
      catalogId: this.account,
      databaseInput: {
        name: 'stage',
        description: 'This datalake db1',
        locationUri: bucketStack.s3BucketStage.s3UrlForObject()
      }
    })
    stageGlueDatabase.node.addDependency(dataLakeSettings)

    const glueEncryption = new glue.CfnSecurityConfiguration(this, 'GlueEncryption', {
      encryptionConfiguration: {
        cloudWatchEncryption: {
          cloudWatchEncryptionMode: 'SSE-KMS',
          kmsKeyArn: kmsStack.key.keyArn
        },
        jobBookmarksEncryption: {
          jobBookmarksEncryptionMode: 'CSE-KMS',
          kmsKeyArn: kmsStack.key.keyArn
        },
        s3Encryptions: [{
          kmsKeyArn: kmsStack.key.keyArn,
          s3EncryptionMode: 'SSE-KMS'
        }]
      },
      name: 'db1-securityconfig'
    })

    // const glueCrawlerRaw = new glue.CfnCrawler(this, 'GlueCrawlerRaw', {
    //   crawlerSecurityConfiguration: glueEncryption.name,
    //   databaseName: (rawGlueDatabase.databaseInput as glue.CfnDatabase.DatabaseInputProperty).name,
    //   description: 'Crawler for raw data tables',
    //   name: 'raw-data-crawler',
    //   role: iamStack.lakehouseGlueRole.roleArn,
    //   tablePrefix: 'raw_',
    //   targets: {
    //     s3Targets: [{
    //       path: `s3://${this.account}${regionMap.findInMap(this.region, 'name')}${bucketNameParam}-raw`
    //     }]
    //   }
    // })

    const worldCasesDeathstestingTableRaw = new glue.CfnTable(this, 'worldCasesDeathsTestingTableRaw', {
      catalogId: this.account,
      databaseName: 'raw',
      tableInput: {
        description: 'Data on confirmed cases, deaths, and testing. Sourced from rearc.',
        name: 'world_cases_deaths_testing',
        parameters: {
          'has_encrypted_data': false,
          'classification': 'json',
          'typeOfData': 'file'
        },
        storageDescriptor: {
          columns: [
            { name: 'iso_code', type: 'string' },
            { name: 'location', type: 'string' },
            { name: 'date', type: 'string' },
            { name: 'total_cases', type: 'double' },
            { name: 'new_cases', type: 'double' },
            { name: 'total_deaths', type: 'double' },
            { name: 'new_deaths', type: 'double' },
            { name: 'total_cases_per_million', type: 'double' },
            { name: 'new_cases_per_million', type: 'double' },
            { name: 'total_deaths_per_million', type: 'double' },
            { name: 'new_deaths_per_million', type: 'double' },
            { name: 'total_tests', type: 'double' },
            { name: 'new_tests', type: 'double' },
            { name: 'total_tests_per_thousand', type: 'double' },
            { name: 'new_tests_per_thousand', type: 'double' },
            { name: 'tests_units', type: 'string' },
          ],
          compressed: false,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          location: bucketStack.s3BucketRaw.s3UrlForObject('rearc-covid-19-world-cases-deaths-testing/json/'),
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            parameters: {
              'paths': 'date,iso_code,location,new_cases,new_cases_per_million,new_deaths,new_deaths_per_million,new_tests,new_tests_per_thousand,tests_units,total_cases,total_cases_per_million,total_deaths,total_deaths_per_million,total_tests,total_tests_per_thousand'
            },
            serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
          },
          storedAsSubDirectories: false,
        },
        tableType: 'EXTERNAL_TABLE'
      }
    })
    worldCasesDeathstestingTableRaw.node.addDependency(rawGlueDatabase)

    const countryCodesTableRaw = new glue.CfnTable(this, 'countryCodesTableRaw', {
      catalogId: this.account,
      databaseName: 'raw',
      tableInput: {
        description: 'Lookup table for country codes',
        name: 'country_codes',
        parameters: {
          'has_encrypted_data': false,
          'classification': 'csv',
          'areColumnsQuoted': false,
          'typeOfData': 'file',
          'columnsOrdered': true,
          'delimiter': ',',
          'skip.header.line.count': '1'
        },
        storageDescriptor: {
          columns: [
            { name: 'Country', type: 'string' },
            { name: 'Alpha-2 code', type: 'string' },
            { name: 'Alpha-3 code', type: 'string' },
            { name: 'Numeric code', type: 'bigint' },
            { name: 'Latitude', type: 'bigint' },
            { name: 'Longitude', type: 'bigint' },
          ],
          compressed: false,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          location: bucketStack.s3BucketRaw.s3UrlForObject('static-datasets/csv/countrycode'),
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            parameters: {
              'field.delim': ','
            },
            serializationLibrary: 'org.apache.hadoop.hive.serde2.lazy.LazySimpleSerDe',
          },
          storedAsSubDirectories: false,
        },
        tableType: 'EXTERNAL_TABLE'
      }
    })
    countryCodesTableRaw.node.addDependency(rawGlueDatabase)

  }
}
