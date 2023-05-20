#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { GetContentStack } from '../lib/get-content-stack';

const app = new cdk.App();
new GetContentStack(app, 'GetContentStack');
