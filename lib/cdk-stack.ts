import { Stack, Duration, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Code, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda'
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';

export class SaveContentStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);
		const API_KEY = process.env.API_KEY;
		const API_KEY_HEADER = process.env.API_KEY_HEADER;
		const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
		const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
		const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
		if (!API_KEY || !API_KEY_HEADER) throw new Error("API_KEY and API_KEY_HEADER must be set in the environment");
		if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) throw new Error("AIRTABLE_API_KEY, AIRTABLE_BASE_ID and AIRTABLE_TABLE_NAME must be set in the environment");

		const contentTable = new Table(
			this, 'content-table-id',
			{
				tableName: 'content-table',
				partitionKey: {
					name: 'id',
					type: AttributeType.STRING,
				},
				sortKey: {
					name: 'created_at',
					type: AttributeType.STRING,
				},
				billingMode: BillingMode.PAY_PER_REQUEST,
			},
		);

		const airtableLayer = new LayerVersion(this, "airtable-layer-id", {
			layerVersionName: 'airtable-layer',
			code: Code.fromAsset(path.resolve(__dirname, 'layer/nodejs.zip')),
			compatibleRuntimes: [Runtime.NODEJS_18_X],
			description: "A layer to hold the 'airtable' module",
		});

		const saveContentLambda = new NodejsFunction(this, 'save-content-id', {
			functionName: 'save-content',
			handler: 'handler',
			entry: path.resolve(__dirname, 'lambda/save-content.ts'),
			runtime: Runtime.NODEJS_18_X,
			projectRoot: path.join(__dirname, '..'),
			layers: [airtableLayer],
			timeout: Duration.seconds(15),
			bundling: {
				minify: false,
				externalModules: ['aws-sdk', 'airtable'],
			},
			initialPolicy: [
				new PolicyStatement({
					effect: Effect.ALLOW,
					actions: ['dynamodb:Query', 'dynamodb:PutItem'],
					resources: [contentTable.tableArn],
				}),
			],
			environment: {
				DYNAMO_DB_CONTENT_TABLE_NAME: contentTable.tableName,
				DYNAMO_DB_CONTENT_TABLE_REGION: contentTable.env.region,
				API_KEY_HEADER: API_KEY_HEADER,
				API_KEY: API_KEY,
				AIRTABLE_BASE_ID: AIRTABLE_BASE_ID,
				AIRTABLE_API_KEY: AIRTABLE_API_KEY,
				AIRTABLE_TABLE_NAME: AIRTABLE_TABLE_NAME,
			},
		});

		saveContentLambda.node.addDependency(contentTable);
		saveContentLambda.node.addDependency(airtableLayer);

		new apigw.LambdaRestApi(this, 'save-content-lambda-rest-api-endpoint', {
			handler: saveContentLambda,
		});
	}
}
