#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SaveContentStack } from '../lib/cdk-stack';
import * as dotenv from 'dotenv';
import * as process from "process";

dotenv.config();

const region = process.env.AWS_REGION
const account = process.env.AWS_ACCOUNT
if (!region || !account) {
	throw new Error("Please set REGION and ACCOUNT in .env file")
}

const app = new cdk.App();
new SaveContentStack(app, 'SaveContentStack', { env: { region, account } });
