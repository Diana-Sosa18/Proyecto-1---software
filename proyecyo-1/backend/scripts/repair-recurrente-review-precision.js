const fs = require('node:fs');
async function main(args = process.argv.slice(2)) {
  if (new Set(args).size !== args.length || args.some(a => !['--prepare-schema','--apply'].includes(a)
    && !a.startsWith('--source=') && !/^--sha256=[a-f0-9]{64}$/.test(a))
    || args.filter(a => a.startsWith('--source=')).length > 1 || args.filter(a => a.startsWith('--sha256=')).length > 1) throw new Error('PRECISION_OPTIONS');
  const prepare = args.includes('--prepare-schema'), apply = args.includes('--apply');
  const source = args.find(a => a.startsWith('--source='))?.slice(9), hash = args.find(a => a.startsWith('--sha256='))?.slice(9);
  if (prepare ? args.length !== 1 : !source || !hash) throw new Error('PRECISION_OPTIONS');
  const config = require('./start-hu13-sandbox').configureManualEnvironment();
  const service = require('../src/services/recurrenteReviewPrecisionRepair');
  // Authenticate the selected evidence file before acquiring any DB connection.
  const evidence = prepare ? null : service.readEvidence(fs.readFileSync(source),hash,config.database);
  const db = require('../src/database/mysql');
  try {
    const c = await db.pool.getConnection();
    try {
      const [[identity]] = await c.query('SELECT DATABASE() db'); if (identity.db !== config.database) throw new Error('PRECISION_DATABASE');
      if (prepare) {
        await require('../src/database/recurrenteMigration').applyRecurrenteReviewPrecisionMigration(c);
        console.info(JSON.stringify({migration:'007',database:config.database,financialRowsModified:0}));
      } else console.info(JSON.stringify({database:config.database,...await service.repairReviewPrecision(c,{evidence,database:config.database,apply})}));
    } finally { c.release(); }
  } finally { await db.pool.end(); }
}
if (require.main === module) main().catch(() => {
  console.error('Reparacion detenida: verifica base TEST, esquema 007 y evidencia original integramente vinculada.'); process.exitCode = 1;
});
module.exports = { main };
