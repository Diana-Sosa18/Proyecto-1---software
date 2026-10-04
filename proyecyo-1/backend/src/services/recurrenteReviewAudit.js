// Internal MySQL timestamps must never round-trip through a JS Date (milliseconds).
async function archiveReview(connection, eventId, operator) {
  const [result] = await connection.execute(`INSERT INTO REVISION_EVENTO_RECURRENTE
    (id_evento,ambiente,estado_anterior,error_anterior,intentos_anteriores,procesado_anterior,operador)
    SELECT id_evento,ambiente,estado,error_codigo,intentos,procesado_en,?
    FROM EVENTO_RECURRENTE WHERE id_evento=? AND estado='REVISION'`, [operator, eventId]);
  if (result.affectedRows !== 1) throw new Error('REVIEW_ARCHIVE_CONFLICT');
  return result.insertId;
}
module.exports = { archiveReview };
