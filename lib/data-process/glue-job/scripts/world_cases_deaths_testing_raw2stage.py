import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from awsglue.job import Job
import gs_to_timestamp

import boto3

sts_client = boto3.client('sts')
identity = sts_client.get_caller_identity()

account = identity['Account']
region = sts_client.meta.region_name

args = getResolvedOptions(sys.argv, ["JOB_NAME"])
sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args["JOB_NAME"], args)

# Script generated for node S3 bucket
S3bucket_node1 = glueContext.create_dynamic_frame.from_catalog(
    database="raw",
    table_name="rearc_covid_19_world_cases_deaths_testing",
    transformation_ctx="S3bucket_node1",
)

# Script generated for node To Timestamp
ToTimestamp_node1682951186980 = S3bucket_node1.gs_to_timestamp(
    colName="date", colType="autodetect"
)

# Script generated for node S3 bucket
S3bucket_node3 = glueContext.getSink(
    path=f"s3://{account}-virginia-lakehouse-datalake-stage/rearc-covid-19-world-cases-deaths-testing/",
    connection_type="s3",
    updateBehavior="UPDATE_IN_DATABASE",
    # partitionKeys=["iso_code", "date"],
    partitionKeys=["date"],
    compression="snappy",
    enableUpdateCatalog=True,
    transformation_ctx="S3bucket_node3",
)
S3bucket_node3.setCatalogInfo(
    catalogDatabase="stage", catalogTableName="world_cases_deaths_testing"
)
S3bucket_node3.setFormat("glueparquet")
S3bucket_node3.writeFrame(ToTimestamp_node1682951186980)
job.commit()
