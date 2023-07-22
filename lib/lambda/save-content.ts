// @ts-ignore
import airtable from 'airtable';
import * as process from "process";
import { v4 as uuidv4 } from 'uuid';
import {
	AttributeValue,
	DynamoDBClient,
	PutItemCommand,
} from '@aws-sdk/client-dynamodb';

type LambdaEvent = {
	path?: string,
	headers?: { [key: string]: string },
	body?: string;
};

const AIRTABLE_ENDPOINT_URL = 'https://api.airtable.com'
const PATH = '/content';
const API_KEY_HEADER = process.env.API_KEY_HEADER;
const API_KEY = process.env.API_KEY
const DYNAMO_DB_CONTENT_TABLE_NAME = process.env.DYNAMO_DB_CONTENT_TABLE_NAME;
const DYNAMO_DB_CONTENT_TABLE_REGION = process.env.DYNAMO_DB_CONTENT_TABLE_REGION;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const LambdaEvent = (obj: any): obj is LambdaEvent => {
	return 'path' in obj && 'headers' in obj && 'body' in obj;
}

interface Content {
	title: string;
	text: string;
	summary: string;
	url: string;
	categories: string[];
}

const saveToDynamoDB = ({ title, text, categories, summary, url }: Content) => {
	const dbClient = new DynamoDBClient({
		region: DYNAMO_DB_CONTENT_TABLE_REGION,
	});

	const input: Record<'id' | 'created_at' | 'title' | 'summary' | 'text' | 'categories' | 'url', AttributeValue> = {
		'id': {
			S: uuidv4(),
		},
		'created_at': {
			S: new Date().toISOString(),
		},
		'title': {
			S: title,
		},
		summary: {
			S: summary,
		},
		text: {
			S: text,
		},
		url: {
			S: url,
		},
		categories: {
			S: categories.join(', '),
		}
	};

	const command = new PutItemCommand({
		TableName: DYNAMO_DB_CONTENT_TABLE_NAME,
		Item: input,
		ReturnValues: 'ALL_OLD',
	});

	return dbClient.send(command);
}

const saveToAirtable = ({ title, categories, summary, url }: Content) => {

	if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
		throw new Error('Missing AIRTABLE_API_KEY, AIRTABLE_BASE_ID or AIRTABLE_TABLE_NAME');
	}

	airtable.configure({
		endpointUrl: AIRTABLE_ENDPOINT_URL,
		apiKey: AIRTABLE_API_KEY
	});
	const base = airtable.base(AIRTABLE_BASE_ID);

	const promise = new Promise((resolve, reject) => {


		base(AIRTABLE_TABLE_NAME).create([
			{
				"fields": {
					"title": title,
					"summary": summary,
					"url": url,
					"categories": categories.join(', '),
				}
			},

		], function (err, records) {
			if (err) {
				console.error(err);
				reject(err)
				return;
			}
			if (!records) {
				console.error('No records');
				return;
			}
			records.forEach(function (record) {
				console.log(record.getId());
			});
			resolve(records)
		});
	})

	return promise
}

exports.handler = async (event: unknown, context: unknown) => {
	try {
		if (!event || !LambdaEvent(event)) throw new Error('Invalid or missing event');
		if (!context) throw new Error('Invalid or missing context');

		if (!event.headers) throw new Error('Missing headers');
		if (!API_KEY_HEADER || !API_KEY) throw new Error('Missing API_KEY_HEADER or API_KEY');
		if (!DYNAMO_DB_CONTENT_TABLE_NAME || !DYNAMO_DB_CONTENT_TABLE_REGION) throw new Error('Missing DYNAMO_DB_CONTENT_TABLE_NAME or DYNAMO_DB_CONTENT_TABLE_REGION');
		if (event.headers[API_KEY_HEADER] !== API_KEY) {
			console.warn(`Invalid API key: ${event.headers[API_KEY_HEADER]}`);

			return {
				statusCode: 500,
			};
		}
		if (event.path !== PATH) throw new Error(`Invalid path. Expected ${PATH}`);
		if (!event.body) throw new Error('Missing body');

		const { title, text, categories, summary, url } = JSON.parse(event.body);

		if (typeof title !== 'string' || typeof text !== 'string' || typeof summary !== 'string' || typeof url !== 'string' || !Array.isArray(categories)) {
			throw new Error('Invalid body params');
		}

		const dynamoDBPromise = saveToDynamoDB({ title, text, categories, summary, url })

		const airtablePromise = saveToAirtable({ title, text, categories, summary, url })

		const result = await Promise.all([dynamoDBPromise, airtablePromise])

		return {
			statusCode: 200,
			body: JSON.stringify(result),
		};
	} catch
		(error) {
		if (error instanceof Error) {
			return {
				statusCode: 500,
				body: JSON.stringify({ error: error.message }),
			};
		}

		return { statusCode: 500 }
	}
}
;
