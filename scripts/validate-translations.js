#!/usr/bin/env node
'use strict';
const { buildTranslations, validateTranslations } = require('./i18n');

try {
  buildTranslations();
  const { errors, warnings } = validateTranslations();
  for (const warning of warnings) console.warn('warning: ' + warning);
  for (const error of errors) console.error('error:   ' + error);
  if (errors.length) {
    console.error('\n' + errors.length + ' error(s), ' + warnings.length + ' warning(s)');
    process.exit(1);
  }
  console.log('All translations passed validation (' + warnings.length + ' warning(s)).');
} catch (error) {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
