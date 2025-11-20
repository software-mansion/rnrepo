import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../libraries.schema.json';
import data from '../../../libraries.json';

const ajv = new Ajv();
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(data);

if (valid) {
  console.log('✅ libraries.json is valid!');
  process.exit(0);
} else {
  console.error('❌ libraries.json is invalid!');
  console.error('Errors:');
  validate.errors?.forEach((error) => {
    console.error(`  - ${error.instancePath || '/'}: ${error.message}`);
    if (error.params) {
      console.error(`    ${JSON.stringify(error.params, null, 2)}`);
    }
  });
  process.exit(1);
}

