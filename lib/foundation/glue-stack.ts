import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as glue from 'aws-cdk-lib/aws-glue';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lakeformation from 'aws-cdk-lib/aws-lakeformation';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

import { BucketStack } from './bucket-stack';
import { KmsStack } from './kms-stack';

export class GlueStack extends cdk.Stack {
  constructor(scope: Construct, id: string,
    regionMap: cdk.CfnMapping,
    cFNExecRoleOrUserArnParam: string,
    kmsStack: KmsStack,
    bucketStack: BucketStack,
    props?: cdk.StackProps) {

    super(scope, id, props);

    /**
     * Lake Formation
     */

    const dataLakeSettings = new lakeformation.CfnDataLakeSettings(this, 'DataLakeSettings', {
      admins: [
        { dataLakePrincipalIdentifier: cFNExecRoleOrUserArnParam },
        { dataLakePrincipalIdentifier: `arn:aws:iam::${this.account}:role/cdk-hnb659fds-cfn-exec-role-${this.account}-${this.region}` },
      ],
    })

    const datalakelocationRaw = new lakeformation.CfnResource(this, 'datalakelocationRaw', {
      resourceArn: bucketStack.s3BucketRaw.bucketArn,
      useServiceLinkedRole: true
    })

    const datalakelocationStage = new lakeformation.CfnResource(this, 'datalakelocationStage', {
      resourceArn: bucketStack.s3BucketStage.bucketArn,
      useServiceLinkedRole: true
    })


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
    lakehouseGlueRole.node.addDependency(dataLakeSettings)

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


    /**
     * Database
     */

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

    /**
     * Table
     */

    const worldCasesDeathstestingTableRaw = new glue.CfnTable(this, 'worldCasesDeathsTestingTableRaw', {
      catalogId: this.account,
      databaseName: 'raw',
      tableInput: {
        description: 'Data on confirmed cases, deaths, and testing. Sourced from rearc.',
        name: 'rearc_covid_19_world_cases_deaths_testing',
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

            { name: 'total_cases_per_million', type: 'double' },
            { name: 'new_cases_per_million', type: 'double' },

            { name: 'tests_units', type: 'string' },

            { name: 'total_deaths', type: 'double' },
            { name: 'new_deaths', type: 'double' },

            { name: 'total_deaths_per_million', type: 'double' },
            { name: 'new_deaths_per_million', type: 'double' },

          ],
          compressed: false,
          inputFormat: 'org.apache.hadoop.mapred.TextInputFormat',
          location: bucketStack.s3BucketRaw.s3UrlForObject('rearc-covid-19-world-cases-deaths-testing/json/'),
          outputFormat: 'org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat',
          serdeInfo: {
            serializationLibrary: 'org.openx.data.jsonserde.JsonSerDe',
            parameters: {
              'paths': 'date,iso_code,location,new_cases,new_cases_per_million,new_deaths,new_deaths_per_million,tests_units,total_cases,total_cases_per_million,total_deaths,total_deaths_per_million'
            },
          },
          storedAsSubDirectories: false,
        },
        tableType: 'EXTERNAL_TABLE'
      }
    })
    worldCasesDeathstestingTableRaw.node.addDependency(rawGlueDatabase)

    /**
     * Crawler
     */

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


    const countrycodeCrawler = new glue.CfnCrawler(this, 'countrycodeCrawler', {
      // crawlerSecurityConfiguration: glueEncryption.name,
      databaseName: (rawGlueDatabase.databaseInput as glue.CfnDatabase.DatabaseInputProperty).name,
      description: 'Crawler for countrycode data tables',
      name: 'countrycode-data-crawler',
      role: lakehouseGlueRole.roleArn,
      tablePrefix: '',
      targets: {
        s3Targets: [
          {
            path: bucketStack.s3BucketRaw.s3UrlForObject('static-datasets/csv/countrycode'),
            exclusions: ['**/.aws-datasync/**']
          },
        ]
      },
      configuration: '{\"Version\":1.0,\"Grouping\":{\"TableGroupingPolicy\":\"CombineCompatibleSchemas\"},\"CreatePartitionIndex\":true}',
    })

    const sitewiseCrawlerRaw = new glue.CfnCrawler(this, 'sitewiseCrawlerRaw', {
      // crawlerSecurityConfiguration: glueEncryption.name,
      databaseName: (rawGlueDatabase.databaseInput as glue.CfnDatabase.DatabaseInputProperty).name,
      description: 'Crawler for sitewise data tables',
      name: 'sitewise-data-crawler',
      role: lakehouseGlueRole.roleArn,
      tablePrefix: 'sitewise_',
      targets: {
        s3Targets: [
          { path: bucketStack.s3BucketRaw.s3UrlForObject('iot-sitewise/agg/') },
          { path: bucketStack.s3BucketRaw.s3UrlForObject('iot-sitewise/asset_hierarchy_metadata/') },
          { path: bucketStack.s3BucketRaw.s3UrlForObject('iot-sitewise/asset_metadata/') },
          { path: bucketStack.s3BucketRaw.s3UrlForObject('iot-sitewise/index/') },
          { path: bucketStack.s3BucketRaw.s3UrlForObject('iot-sitewise/raw/') },
        ]
      },
      schedule: {
        scheduleExpression: 'cron(0 * * * ? *)'
      }
    })

    /**
     * Job
     */

    const s3BucketJob = new s3.Bucket(this, 's3BucketJob', {
      accessControl: s3.BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: kmsStack.key,
      bucketName: `aws-glue-assets-${this.account}${regionMap.findInMap(this.region, 'name')}`,
    })

    const jobDeploy = new s3deploy.BucketDeployment(this, 'jobDeploy', {
      destinationBucket: s3BucketJob,
      destinationKeyPrefix: 'asset/',
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../data-process/glue-job'))
      ],
    })

    const worldCasesDeathsTestingRaw2stageJob = new glue.CfnJob(this, 'worldCasesDeathsTestingJob', {
      name: 'world_cases_deaths_testing_raw2stage',
      command: {
        name: 'glueetl',
        scriptLocation: s3BucketJob.s3UrlForObject('/asset/scripts/world_cases_deaths_testing_raw2stage.py'),
        pythonVersion: '3'
      },
      role: lakehouseGlueRole.roleArn,
      defaultArguments: {
        '--enable-metrics': 'true',
        '--extra-py-files': 's3://aws-glue-studio-transforms-510798373988-prod-us-east-1/gs_common.py,s3://aws-glue-studio-transforms-510798373988-prod-us-east-1/gs_to_timestamp.py',
        '--enable-glue-datacatalog': 'true',
        '--enable-continuous-cloudwatch-log': 'true',
        '--job-bookmark-option': 'job-bookmark-enable',
        '--job-language': 'python',
        '--TempDir': s3BucketJob.s3UrlForObject('temporary/')
      },
      workerType: 'G.1X',
      numberOfWorkers: 2,
      glueVersion: '3.0',
    })

    const countrycodesJob = new glue.CfnJob(this, 'countrycodesJob', {
      name: 'countrycodes_raw2stage',
      command: {
        name: 'glueetl',
        scriptLocation: s3BucketJob.s3UrlForObject('/asset/scripts/countrycodes_raw2stage.py'),
        pythonVersion: '3'
      },
      role: lakehouseGlueRole.roleArn,
      defaultArguments: {
        '--enable-metrics': 'true',
        '--extra-py-files': 's3://aws-glue-studio-transforms-510798373988-prod-us-east-1/gs_common.py,s3://aws-glue-studio-transforms-510798373988-prod-us-east-1/gs_to_timestamp.py',
        '--enable-glue-datacatalog': 'true',
        '--enable-continuous-cloudwatch-log': 'true',
        '--job-bookmark-option': 'job-bookmark-enable',
        '--job-language': 'python',
        '--TempDir': s3BucketJob.s3UrlForObject('temporary/')
      },
      workerType: 'G.1X',
      numberOfWorkers: 2,
      glueVersion: '3.0',
    })

    /**
     * Workflow
     */

    const covid19Workflow = new glue.CfnWorkflow(this, 'covid19Workflow', {
      name: 'covid19-workflow',
    })

    const scheduledTrigger = new glue.CfnTrigger(this, 'scheduledTrigger', {
      name: 'scheduledTrigger',
      type: 'SCHEDULED',
      schedule: 'cron(0 * * * ? *)',
      actions: [
        { crawlerName: countrycodeCrawler.name },
        { jobName: worldCasesDeathsTestingRaw2stageJob.name },
      ],
      workflowName: covid19Workflow.name
    })

    const conditionalTrigger = new glue.CfnTrigger(this, 'conditionalTrigger', {
      name: 'conditionalTrigger',
      type: 'CONDITIONAL',
      predicate: {
        conditions: [
          { crawlerName: countrycodeCrawler.name, crawlState: 'SUCCEEDED', logicalOperator: 'EQUALS' }
        ]
      },
      actions: [
        { jobName: countrycodesJob.name },
      ],
      workflowName: covid19Workflow.name
    })


  }
}
