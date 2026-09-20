const { v4: uuidv4 } = require('uuid');

/**
 * Converts the original numeric-ID signing links into the current tokenized
 * signing flow. Numeric contract IDs are never accepted as signing authority:
 * the handler atomically obtains or creates an unguessable signing token and
 * then redirects the browser to the normal public signing page.
 */
async function redirectLegacyContractSigningLink(req, res) {
  const rawId = req.params.id;
  if (!/^\d+$/.test(rawId)) {
    return res.status(404).send('Contract signing link not found.');
  }

  const contractId = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(contractId) || contractId < 1) {
    return res.status(404).send('Contract signing link not found.');
  }

  try {
    const { rows: contracts } = await req.db.query(
      'SELECT id, status FROM contracts WHERE id = $1',
      [contractId]
    );
    const contract = contracts[0];

    if (!contract) {
      return res.status(404).send('Contract signing link not found.');
    }
    if (contract.status === 'signed') {
      return res.status(409).send('This contract has already been signed.');
    }

    // COALESCE/NULLIF preserves an existing token and makes new token creation
    // atomic, so concurrent requests cannot produce competing signing links.
    const candidateToken = uuidv4();
    const { rows: updated } = await req.db.query(
      `UPDATE contracts
       SET sign_token = COALESCE(NULLIF(sign_token, ''), $1)
       WHERE id = $2 AND status <> 'signed'
       RETURNING sign_token`,
      [candidateToken, contractId]
    );
    const signToken = updated[0]?.sign_token;

    if (!signToken) {
      return res.status(409).send('This contract is no longer available for signing.');
    }

    return res.redirect(302, `/sign-contract/${encodeURIComponent(signToken)}`);
  } catch (error) {
    console.error('[CONTRACTS] Legacy signing link redirect failed:', error.message);
    return res.status(500).send('Unable to open this contract signing link. Please try again later.');
  }
}

module.exports = { redirectLegacyContractSigningLink };
