import test from 'node:test';
import assert from 'node:assert/strict';
import {score} from '../index.js';

const job={skills:'Java,Spring Boot,microservices',min_exp:5,max_exp:8,max_notice:60};
const person={skills:'Java,Spring Boot,microservices',experience:6.5,notice:60,summary:'Built Spring Boot microservices for banking.'};
test('scores full skill, experience, and notice match at 100',()=>{const result=score(person,job);assert.equal(result.score,100);assert.equal(result.evidence.length,3)});
test('shows missing skill evidence and retains a low score for search',()=>{const result=score({...person,skills:'Python,Django',experience:2,notice:120},job);assert.ok(result.score<55);assert.match(result.evidence[0].detail,/No required skill match/)});
test('caps each skill contribution at 65 points',()=>{const result=score({...person,skills:'Java'},job);assert.equal(result.score,22+25+10)});
