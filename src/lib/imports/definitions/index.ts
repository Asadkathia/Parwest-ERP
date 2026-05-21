/**
 * Bulk Import definitions barrel.
 *
 * Importing this module registers every defined import. Routes/UI must
 * import this once (e.g. from the workflow shim) before resolving a
 * definition by (module, subModule).
 *
 * The current ERP exposes only the 4 top-level imports below. Sub-import
 * definitions can be registered here once the corresponding UI / target
 * Prisma models are confirmed.
 */

import "./users"
import "./guards"
import "./clients"
import "./inventory"
import "./loans"
