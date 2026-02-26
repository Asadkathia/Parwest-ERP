const BASE_URL = 'http://localhost:3000';
let cookieJar = {};

function serializeCookies() {
    return Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbCookies(headerValue) {
    if (!headerValue) return;
    const values = Array.isArray(headerValue) ? headerValue : [headerValue];
    for (const entry of values) {
        for (const part of entry.split(', ')) {
            const [pair] = part.split(';');
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) continue;
            const key = pair.substring(0, eqIdx).trim();
            const val = pair.substring(eqIdx + 1).trim();
            cookieJar[key] = val;
        }
    }
}

async function loginAs({ email, password, label = 'user' }) {
    cookieJar = {};

    // Step 1: Get CSRF token
    const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
        headers: { 'Cookie': serializeCookies() }
    });
    absorbCookies(csrfRes.headers.get('set-cookie'));
    const { csrfToken } = await csrfRes.json();
    if (!csrfToken) { console.error('No CSRF token'); process.exit(1); }

    // Step 2: Credentials login
    const params = new URLSearchParams({
        email,
        password,
        csrfToken,
        redirect: 'false',
        json: 'true'
    });
    const signInRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': serializeCookies()
        },
        body: params,
        redirect: 'manual'
    });
    absorbCookies(signInRes.headers.get('set-cookie'));
    console.log(`${label} login status:`, signInRes.status);

    // Step 3: Verify session
    const sessRes = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: { 'Cookie': serializeCookies() }
    });
    absorbCookies(sessRes.headers.get('set-cookie'));
    const session = await sessRes.json();
    if (session?.user?.email) {
        console.log(`${label} session active for:`, session.user.email, '| Role:', session.user.role);
    } else {
        console.error(`${label} session not established. Aborting.`, session);
        process.exit(1);
    }

    return session;
}

async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json', 'Cookie': serializeCookies() } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${path}`, opts);
    absorbCookies(res.headers.get('set-cookie'));
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
}

function pass(route, detail) { console.log(`  ✅ ${route}: ${detail}`); }
function fail(route, detail) { console.log(`  ❌ ${route}: ${detail}`); }
function check(label, condition, detail) {
    condition ? pass(label, detail) : fail(label, detail);
}

async function run() {
    await loginAs({
        email: 'admin@parwestgroup.com',
        password: 'admin123@',
        label: 'admin',
    });

    const results = [];
    function record(route, status, expected, actual, note) {
        results.push({ route, status, expected, actual, note });
        const ok = status === 'PASS';
        console.log(`  ${ok ? '✅' : '❌'} [${status}] ${route}: ${note || ''}`);
    }

    // =========== ROLES ===========
    console.log('\n=== ROLES ===');
    const roles = await api('GET', '/api/roles');
    check('GET /api/roles', roles.status === 200, `${roles.status}`);
    record('/api/roles GET', roles.status === 200 ? 'PASS' : 'FAIL', 200, roles.status, `items=${Array.isArray(roles.data) ? roles.data.length : 'N/A'}`);
    const roleId = Array.isArray(roles.data) && roles.data.find(r => r.name === 'Manager')?.id;

    // =========== REGIONS ===========
    console.log('\n=== REGIONS ===');
    const regions = await api('GET', '/api/regions');
    check('GET /api/regions', regions.status === 200, `${regions.status}`);
    record('/api/regions GET', regions.status === 200 ? 'PASS' : 'FAIL', 200, regions.status, `items=${Array.isArray(regions.data) ? regions.data.length : 'N/A'}`);
    const regionId = Array.isArray(regions.data) && regions.data[0]?.id;

    const regionCreate = await api('POST', '/api/regions', { name: `Test Region ${Date.now()}` });
    check('POST /api/regions', regionCreate.status === 201, `${regionCreate.status}`);
    record('/api/regions POST', regionCreate.status === 201 ? 'PASS' : 'FAIL', 201, regionCreate.status, regionCreate.data?.name || regionCreate.data?.message);
    const newRegionId = regionCreate.data?.id;

    // =========== OFFICES ===========
    console.log('\n=== REGIONAL OFFICES ===');
    const offices = await api('GET', '/api/regional-offices');
    check('GET /api/regional-offices', offices.status === 200, `${offices.status}`);
    record('/api/regional-offices GET', offices.status === 200 ? 'PASS' : 'FAIL', 200, offices.status, `items=${Array.isArray(offices.data) ? offices.data.length : 'N/A'}`);
    const officeId = Array.isArray(offices.data) && offices.data[0]?.id;

    // =========== USERS ===========
    console.log('\n=== USERS ===');
    const testEmail = `integ_${Date.now()}@example.com`;

    // 400 missing fields
    const u400 = await api('POST', '/api/users', { email: 'badinput@x.com' });
    check('POST /api/users (missing fields)', u400.status === 400, `${u400.status}`);
    record('/api/users POST 400', u400.status === 400 ? 'PASS' : 'FAIL', 400, u400.status, u400.data?.message);

    // 201 create
    const uCreate = await api('POST', '/api/users', {
        name: 'Integration Test User',
        email: testEmail,
        roleId,
        regionId: regionId || undefined,
        regionalOfficeId: officeId || undefined,
        contactNumber: '03001234567',
        password: 'Test@12345',
        status: 'ACTIVE'
    });
    check('POST /api/users (valid)', uCreate.status === 201, `${uCreate.status}`);
    record('/api/users POST 201', uCreate.status === 201 ? 'PASS' : 'FAIL', 201, uCreate.status, uCreate.data?.email || uCreate.data?.message);
    const testUserId = uCreate.data?.id;

    // 409 duplicate
    const u409 = await api('POST', '/api/users', {
        name: 'Dup', email: testEmail, roleId, password: 'pw', status: 'ACTIVE'
    });
    check('POST /api/users (duplicate email)', u409.status === 409, `${u409.status}`);
    record('/api/users POST 409', u409.status === 409 ? 'PASS' : 'FAIL', 409, u409.status, u409.data?.message);

    // GET users list
    const uList = await api('GET', '/api/users');
    check('GET /api/users', uList.status === 200, `${uList.status}`);
    const createdUserFound = Array.isArray(uList.data) && uList.data.some(u => u.email === testEmail);
    check('GET /api/users finds new user', createdUserFound, createdUserFound ? 'Found' : 'Not found');
    record('/api/users GET', uList.status === 200 ? 'PASS' : 'FAIL', 200, uList.status, `count=${Array.isArray(uList.data) ? uList.data.length : 'N/A'}, found_new=${createdUserFound}`);

    // GET /api/users?search=
    const uSearch = await api('GET', `/api/users?search=Integration+Test`);
    check('GET /api/users?search=', uSearch.status === 200, `${uSearch.status}`);
    record('/api/users GET search', uSearch.status === 200 ? 'PASS' : 'FAIL', 200, uSearch.status, `results=${Array.isArray(uSearch.data) ? uSearch.data.length : 'N/A'}`);

    // Permissions
    const perms = await api('GET', '/api/user-permissions?userId=' + testUserId);
    check('GET /api/user-permissions', perms.status === 200 || perms.status === 404, `${perms.status}`);
    record('/api/user-permissions GET', (perms.status === 200 || perms.status === 404) ? 'PASS' : 'FAIL', '200/404', perms.status, String(perms.data?.message || ''));

    // =========== MS/CS RELATIONSHIPS ===========
    console.log('\n=== RELATIONSHIPS ===');
    const msGet = await api('GET', '/api/users/ms-relationships');
    check('GET /api/users/ms-relationships', msGet.status === 200, `${msGet.status}`);
    record('/api/users/ms-relationships GET', msGet.status === 200 ? 'PASS' : 'FAIL', 200, msGet.status, `items=${Array.isArray(msGet.data) ? msGet.data.length : 'N/A'}`);

    const csGet = await api('GET', '/api/users/cs-relationships');
    check('GET /api/users/cs-relationships', csGet.status === 200, `${csGet.status}`);
    record('/api/users/cs-relationships GET', csGet.status === 200 ? 'PASS' : 'FAIL', 200, csGet.status, `items=${Array.isArray(csGet.data) ? csGet.data.length : 'N/A'}`);

    // =========== REQUISITIONS ===========
    console.log('\n=== REQUISITIONS ===');
    const reqList = await api('GET', '/api/requisitions');
    check('GET /api/requisitions', reqList.status === 200, `${reqList.status}`);
    record('/api/requisitions GET', reqList.status === 200 ? 'PASS' : 'FAIL', 200, reqList.status, `items=${Array.isArray(reqList.data) ? reqList.data.length : 'N/A'}`);

    const reqCreate = await api('POST', '/api/requisitions', {
        title: `Test Req ${Date.now()}`,
        module: 'Guards',
        description: 'Integration test requisition',
        amount: 5000,
        priority: 'HIGH'
    });
    check('POST /api/requisitions', reqCreate.status === 201, `${reqCreate.status}`);
    record('/api/requisitions POST', reqCreate.status === 201 ? 'PASS' : 'FAIL', 201, reqCreate.status, reqCreate.data?.title || reqCreate.data?.message);
    const reqId = reqCreate.data?.id;

    // 400 missing title
    const req400 = await api('POST', '/api/requisitions', { amount: 100 });
    check('POST /api/requisitions (missing title)', req400.status === 400, `${req400.status}`);
    record('/api/requisitions POST 400', req400.status === 400 ? 'PASS' : 'FAIL', 400, req400.status, req400.data?.message);

    // Approve/Reject
    if (reqId) {
        const approve = await api('PATCH', `/api/requisitions/${reqId}`, { status: 'APPROVED', decisionNotes: 'Integration test approval' });
        check(`PATCH /api/requisitions/${reqId} approve`, approve.status === 200, `${approve.status}`);
        record('/api/requisitions/[id] PATCH approve', approve.status === 200 ? 'PASS' : 'FAIL', 200, approve.status, approve.data?.status || approve.data?.message);

        const getById = await api('GET', `/api/requisitions/${reqId}`);
        check(`GET /api/requisitions/${reqId}`, getById.status === 200, `${getById.status}`);
        record('/api/requisitions/[id] GET', getById.status === 200 ? 'PASS' : 'FAIL', 200, getById.status, `status=${getById.data?.status}`);

        // 404 invalid ID
        const req404 = await api('GET', '/api/requisitions/nonexistent-id-123');
        check('GET /api/requisitions (404)', req404.status === 404, `${req404.status}`);
        record('/api/requisitions/[id] GET 404', req404.status === 404 ? 'PASS' : 'FAIL', 404, req404.status, req404.data?.message);
    }

    // =========== TICKETING ===========
    console.log('\n=== TICKETING ===');
    const catList = await api('GET', '/api/tickets/categories');
    check('GET /api/tickets/categories', catList.status === 200, `${catList.status}`);
    record('/api/tickets/categories GET', catList.status === 200 ? 'PASS' : 'FAIL', 200, catList.status, `items=${Array.isArray(catList.data) ? catList.data.length : 'N/A'}`);

    const priList = await api('GET', '/api/tickets/priorities');
    check('GET /api/tickets/priorities', priList.status === 200, `${priList.status}`);
    record('/api/tickets/priorities GET', priList.status === 200 ? 'PASS' : 'FAIL', 200, priList.status, `items=${Array.isArray(priList.data) ? priList.data.length : 'N/A'}`);

    const stsList = await api('GET', '/api/tickets/statuses');
    check('GET /api/tickets/statuses', stsList.status === 200, `${stsList.status}`);
    record('/api/tickets/statuses GET', stsList.status === 200 ? 'PASS' : 'FAIL', 200, stsList.status, `items=${Array.isArray(stsList.data) ? stsList.data.length : 'N/A'}`);

    const catId = Array.isArray(catList.data) && catList.data[0]?.id;
    const priId = Array.isArray(priList.data) && priList.data[0]?.id;
    const stsId = Array.isArray(stsList.data) && stsList.data[0]?.id;

    const ticketCreate = await api('POST', '/api/tickets', {
        subject: `Test Ticket ${Date.now()}`,
        description: 'Integration test ticket',
        categoryId: catId || undefined,
        priorityId: priId || undefined,
        statusId: stsId || undefined
    });
    check('POST /api/tickets', ticketCreate.status === 201, `${ticketCreate.status}`);
    record('/api/tickets POST', ticketCreate.status === 201 ? 'PASS' : 'FAIL', 201, ticketCreate.status, ticketCreate.data?.title || ticketCreate.data?.message);
    const ticketId = ticketCreate.data?.id;

    const ticket400 = await api('POST', '/api/tickets', { description: 'No subject' });
    check('POST /api/tickets (missing title)', ticket400.status === 400, `${ticket400.status}`);
    record('/api/tickets POST 400', ticket400.status === 400 ? 'PASS' : 'FAIL', 400, ticket400.status, ticket400.data?.message);

    const ticketList = await api('GET', '/api/tickets');
    check('GET /api/tickets', ticketList.status === 200, `${ticketList.status}`);
    record('/api/tickets GET', ticketList.status === 200 ? 'PASS' : 'FAIL', 200, ticketList.status, `count=${Array.isArray(ticketList.data) ? ticketList.data.length : 'N/A'}`);

    if (ticketId) {
        const tById = await api('GET', `/api/tickets/${ticketId}`);
        check(`GET /api/tickets/${ticketId}`, tById.status === 200, `${tById.status}`);
        record('/api/tickets/[id] GET', tById.status === 200 ? 'PASS' : 'FAIL', 200, tById.status, `title=${tById.data?.title}`);

        const t404 = await api('GET', '/api/tickets/nonexistent-ticket-xyz');
        check('GET /api/tickets (404)', t404.status === 404, `${t404.status}`);
        record('/api/tickets/[id] GET 404', t404.status === 404 ? 'PASS' : 'FAIL', 404, t404.status, t404.data?.message);
    }

    // =========== AUDIT ===========
    console.log('\n=== AUDIT LOGS ===');
    const audit = await api('GET', '/api/audit-logs');
    check('GET /api/audit-logs', audit.status === 200, `${audit.status}`);
    const auditCount = audit.data?.data?.length ?? (Array.isArray(audit.data) ? audit.data.length : 'N/A');
    record('/api/audit-logs GET', audit.status === 200 ? 'PASS' : 'FAIL', 200, audit.status, `items=${auditCount}`);

    const auditSearch = await api('GET', '/api/audit-logs?module=Users');
    check('GET /api/audit-logs?module=Users', auditSearch.status === 200, `${auditSearch.status}`);
    record('/api/audit-logs GET filtered', auditSearch.status === 200 ? 'PASS' : 'FAIL', 200, auditSearch.status, `items=${auditSearch.data?.data?.length ?? 'N/A'}`);

    // =========== SETTINGS ===========
    console.log('\n=== SETTINGS ===');
    // Region update/delete (already tested region create above)
    if (newRegionId) {
        const rUpdate = await api('PATCH', `/api/regions/${newRegionId}`, { name: `Updated Region ${Date.now()}` });
        check(`PATCH /api/regions/${newRegionId}`, rUpdate.status === 200, `${rUpdate.status}`);
        record('/api/regions/[id] PATCH', rUpdate.status === 200 ? 'PASS' : 'FAIL', 200, rUpdate.status, rUpdate.data?.name || rUpdate.data?.message);

        const rDelete = await api('DELETE', `/api/regions/${newRegionId}`);
        check(`DELETE /api/regions/${newRegionId}`, rDelete.status === 200 || rDelete.status === 204, `${rDelete.status}`);
        record('/api/regions/[id] DELETE', (rDelete.status === 200 || rDelete.status === 204) ? 'PASS' : 'FAIL', '200/204', rDelete.status, '');
    }

    // =========== GUARDS (smoke) ===========
    console.log('\n=== GUARDS (smoke) ===');
    const guards = await api('GET', '/api/guards?take=5');
    check('GET /api/guards', guards.status === 200, `${guards.status}`);
    record('/api/guards GET', guards.status === 200 ? 'PASS' : 'FAIL', 200, guards.status, `items=${Array.isArray(guards.data?.data || guards.data) ? (guards.data?.data || guards.data).length : 'N/A'}`);

    // =========== CLIENTS (smoke) ===========
    console.log('\n=== CLIENTS (smoke) ===');
    const clients = await api('GET', '/api/clients?take=5');
    check('GET /api/clients', clients.status === 200, `${clients.status}`);
    record('/api/clients GET', clients.status === 200 ? 'PASS' : 'FAIL', 200, clients.status, `items=${Array.isArray(clients.data?.data || clients.data) ? (clients.data?.data || clients.data).length : 'N/A'}`);

    // =========== PAYROLL ===========
    console.log('\n=== PAYROLL (smoke) ===');
    const loans = await api('GET', '/api/payroll/loans');
    check('GET /api/payroll/loans', loans.status === 200, `${loans.status}`);
    record('/api/payroll/loans GET', loans.status === 200 ? 'PASS' : 'FAIL', 200, loans.status, `items=${Array.isArray(loans.data) ? loans.data.length : 'N/A'}`);

    const extHours = await api('GET', '/api/payroll/extra-hours');
    check('GET /api/payroll/extra-hours', extHours.status === 200, `${extHours.status}`);
    record('/api/payroll/extra-hours GET', extHours.status === 200 ? 'PASS' : 'FAIL', 200, extHours.status, `items=${Array.isArray(extHours.data) ? extHours.data.length : 'N/A'}`);

    const deductions = await api('GET', '/api/payroll/other-deductions');
    check('GET /api/payroll/other-deductions', deductions.status === 200, `${deductions.status}`);
    record('/api/payroll/other-deductions GET', deductions.status === 200 ? 'PASS' : 'FAIL', 200, deductions.status, `items=${Array.isArray(deductions.data) ? deductions.data.length : 'N/A'}`);

    // =========== INVENTORY ===========
    console.log('\n=== INVENTORY (smoke) ===');
    const invCats = await api('GET', '/api/inventory/categories');
    check('GET /api/inventory/categories', invCats.status === 200, `${invCats.status}`);
    record('/api/inventory/categories GET', invCats.status === 200 ? 'PASS' : 'FAIL', 200, invCats.status, `items=${Array.isArray(invCats.data) ? invCats.data.length : 'N/A'}`);

    const invItems = await api('GET', '/api/inventory/items');
    check('GET /api/inventory/items', invItems.status === 200, `${invItems.status}`);
    record('/api/inventory/items GET', invItems.status === 200 ? 'PASS' : 'FAIL', 200, invItems.status, `items=${Array.isArray(invItems.data) ? invItems.data.length : 'N/A'}`);

    // =========== INVENTORY CONDITIONS ===========
    console.log('\n=== INVENTORY CONDITIONS ===');
    const condList = await api('GET', '/api/inventory/conditions');
    check('GET /api/inventory/conditions', condList.status === 200, `${condList.status}`);
    record('/api/inventory/conditions GET', condList.status === 200 ? 'PASS' : 'FAIL', 200, condList.status, `items=${Array.isArray(condList.data) ? condList.data.length : 'N/A'}`);

    const condCreate = await api('POST', '/api/inventory/conditions', { name: `Condition_${Date.now()}`, description: 'Integration test condition' });
    check('POST /api/inventory/conditions', condCreate.status === 201, `${condCreate.status}`);
    record('/api/inventory/conditions POST', condCreate.status === 201 ? 'PASS' : 'FAIL', 201, condCreate.status, condCreate.data?.name || condCreate.data?.message);

    const cond400 = await api('POST', '/api/inventory/conditions', {});
    check('POST /api/inventory/conditions (missing name)', cond400.status === 400, `${cond400.status}`);
    record('/api/inventory/conditions POST 400', cond400.status === 400 ? 'PASS' : 'FAIL', 400, cond400.status, cond400.data?.message);

    // =========== INVENTORY DEMANDS ===========
    console.log('\n=== INVENTORY DEMANDS ===');
    const demList = await api('GET', '/api/inventory/demands');
    check('GET /api/inventory/demands', demList.status === 200, `${demList.status}`);
    record('/api/inventory/demands GET', demList.status === 200 ? 'PASS' : 'FAIL', 200, demList.status, `items=${Array.isArray(demList.data) ? demList.data.length : 'N/A'}`);

    const invCatId = Array.isArray(invCats.data) && invCats.data[0]?.id;
    const demCreate = await api('POST', '/api/inventory/demands', { quantity: 10, categoryId: invCatId || undefined, status: 'PENDING' });
    check('POST /api/inventory/demands', demCreate.status === 201, `${demCreate.status}`);
    record('/api/inventory/demands POST', demCreate.status === 201 ? 'PASS' : 'FAIL', 201, demCreate.status, demCreate.data?.quantity != null ? `qty=${demCreate.data.quantity}` : demCreate.data?.message);

    const dem400 = await api('POST', '/api/inventory/demands', { quantity: -1 });
    check('POST /api/inventory/demands (invalid qty)', dem400.status === 400, `${dem400.status}`);
    record('/api/inventory/demands POST 400', dem400.status === 400 ? 'PASS' : 'FAIL', 400, dem400.status, dem400.data?.message);

    // =========== PAYROLL HOLIDAYS ===========
    console.log('\n=== PAYROLL HOLIDAYS ===');
    const holList = await api('GET', '/api/payroll/holidays');
    check('GET /api/payroll/holidays', holList.status === 200, `${holList.status}`);
    record('/api/payroll/holidays GET', holList.status === 200 ? 'PASS' : 'FAIL', 200, holList.status, `items=${Array.isArray(holList.data) ? holList.data.length : 'N/A'}`);

    const holCreate = await api('POST', '/api/payroll/holidays', { name: `Test Holiday ${Date.now()}`, date: '2026-06-01', notes: 'Integration test' });
    check('POST /api/payroll/holidays', holCreate.status === 201, `${holCreate.status}`);
    record('/api/payroll/holidays POST', holCreate.status === 201 ? 'PASS' : 'FAIL', 201, holCreate.status, holCreate.data?.name || holCreate.data?.message);

    const hol400 = await api('POST', '/api/payroll/holidays', { notes: 'Missing name and date' });
    check('POST /api/payroll/holidays (missing fields)', hol400.status === 400, `${hol400.status}`);
    record('/api/payroll/holidays POST 400', hol400.status === 400 ? 'PASS' : 'FAIL', 400, hol400.status, hol400.data?.message);

    // =========== GUARD BANK NAMES ===========
    console.log('\n=== GUARD BANK NAMES ===');
    const bankList = await api('GET', '/api/guard-bank-names');
    check('GET /api/guard-bank-names', bankList.status === 200, `${bankList.status}`);
    record('/api/guard-bank-names GET', bankList.status === 200 ? 'PASS' : 'FAIL', 200, bankList.status, `items=${Array.isArray(bankList.data) ? bankList.data.length : 'N/A'}`);

    const bankCreate = await api('POST', '/api/guard-bank-names', { name: `TestBank_${Date.now()}` });
    check('POST /api/guard-bank-names', bankCreate.status === 201, `${bankCreate.status}`);
    record('/api/guard-bank-names POST', bankCreate.status === 201 ? 'PASS' : 'FAIL', 201, bankCreate.status, bankCreate.data?.name || bankCreate.data?.message);

    const bank400 = await api('POST', '/api/guard-bank-names', {});
    check('POST /api/guard-bank-names (missing name)', bank400.status === 400, `${bank400.status}`);
    record('/api/guard-bank-names POST 400', bank400.status === 400 ? 'PASS' : 'FAIL', 400, bank400.status, bank400.data?.message);

    // =========== GUARD PLEDGEABLE DOCUMENTS ===========
    console.log('\n=== GUARD PLEDGEABLE DOCUMENTS ===');
    const docList = await api('GET', '/api/guard-pledgeable-documents');
    check('GET /api/guard-pledgeable-documents', docList.status === 200, `${docList.status}`);
    record('/api/guard-pledgeable-documents GET', docList.status === 200 ? 'PASS' : 'FAIL', 200, docList.status, `items=${Array.isArray(docList.data) ? docList.data.length : 'N/A'}`);

    const docCreate = await api('POST', '/api/guard-pledgeable-documents', { name: `TestDoc_${Date.now()}`, description: 'Integration test doc' });
    check('POST /api/guard-pledgeable-documents', docCreate.status === 201, `${docCreate.status}`);
    record('/api/guard-pledgeable-documents POST', docCreate.status === 201 ? 'PASS' : 'FAIL', 201, docCreate.status, docCreate.data?.name || docCreate.data?.message);

    const doc400 = await api('POST', '/api/guard-pledgeable-documents', {});
    check('POST /api/guard-pledgeable-documents (missing name)', doc400.status === 400, `${doc400.status}`);
    record('/api/guard-pledgeable-documents POST 400', doc400.status === 400 ? 'PASS' : 'FAIL', 400, doc400.status, doc400.data?.message);

    // =========== MANAGER SCOPE (PAYROLL) ===========
    console.log('\n=== MANAGER SCOPE (PAYROLL) ===');
    const scopeTs = Date.now();
    let managerRoleId = roleId;
    if (!managerRoleId) {
        const managerRoleCreate = await api('POST', '/api/roles', {
            name: `Manager_${scopeTs}`,
            description: 'Integration manager scope role',
        });
        check('POST /api/roles (manager fallback role)', managerRoleCreate.status === 201, `${managerRoleCreate.status}`);
        record('/api/roles POST manager-fallback', managerRoleCreate.status === 201 ? 'PASS' : 'FAIL', 201, managerRoleCreate.status, managerRoleCreate.data?.name || managerRoleCreate.data?.message);
        managerRoleId = managerRoleCreate.data?.id;
    }

    const allGuards = await api('GET', '/api/guards?take=300');
    const guardRows = Array.isArray(allGuards.data?.data) ? allGuards.data.data : (Array.isArray(allGuards.data) ? allGuards.data : []);
    const scopedGuard = guardRows.find((g) => g?.id && g?.regionId && g?.regionalOfficeId);

    if (!managerRoleId || !scopedGuard) {
        record('/api/payroll manager-scope setup', 'FAIL', 'manager role + guard with scope fields', 'missing setup refs', 'Cannot run manager-scope tests due to missing manager role or scoped guard.');
    } else {
        let outScopeRegionId = Array.isArray(regions.data)
            ? regions.data.find((r) => r?.id && r.id !== scopedGuard.regionId)?.id
            : null;
        if (!outScopeRegionId) {
            const outRegionCreate = await api('POST', '/api/regions', { name: `Manager Scope Region ${scopeTs}` });
            check('POST /api/regions (manager out-scope region)', outRegionCreate.status === 201, `${outRegionCreate.status}`);
            record('/api/regions POST manager-out-scope', outRegionCreate.status === 201 ? 'PASS' : 'FAIL', 201, outRegionCreate.status, outRegionCreate.data?.name || outRegionCreate.data?.message);
            outScopeRegionId = outRegionCreate.data?.id || null;
        }

        const seedLoan = await api('POST', '/api/payroll/loans', {
            guardId: scopedGuard.id,
            month: '2026-01-01',
            amount: 1000,
            status: 'PENDING',
        });
        check('POST /api/payroll/loans (seed scoped guard)', seedLoan.status === 201, `${seedLoan.status}`);
        record('/api/payroll/loans POST seed scoped guard', seedLoan.status === 201 ? 'PASS' : 'FAIL', 201, seedLoan.status, seedLoan.data?.id || seedLoan.data?.message);
        const seedLoanId = seedLoan.data?.id || null;

        const managerInEmail = `manager_scope_in_${scopeTs}@example.com`;
        const managerOutEmail = `manager_scope_out_${scopeTs}@example.com`;
        const managerPassword = 'Test@12345';

        const managerInCreate = await api('POST', '/api/users', {
            name: `Manager Scope In ${scopeTs}`,
            email: managerInEmail,
            password: managerPassword,
            roleId: managerRoleId,
            status: 'ACTIVE',
            regionId: scopedGuard.regionId,
            regionalOfficeId: scopedGuard.regionalOfficeId,
            contactNumber: '03001234567',
        });
        check('POST /api/users (manager in-scope)', managerInCreate.status === 201, `${managerInCreate.status}`);
        record('/api/users POST manager-in-scope', managerInCreate.status === 201 ? 'PASS' : 'FAIL', 201, managerInCreate.status, managerInCreate.data?.email || managerInCreate.data?.message);

        const managerOutCreate = await api('POST', '/api/users', {
            name: `Manager Scope Out ${scopeTs}`,
            email: managerOutEmail,
            password: managerPassword,
            roleId: managerRoleId,
            status: 'ACTIVE',
            regionId: outScopeRegionId,
            regionalOfficeId: null,
            contactNumber: '03001234567',
        });
        check('POST /api/users (manager out-of-scope)', managerOutCreate.status === 201, `${managerOutCreate.status}`);
        record('/api/users POST manager-out-scope', managerOutCreate.status === 201 ? 'PASS' : 'FAIL', 201, managerOutCreate.status, managerOutCreate.data?.email || managerOutCreate.data?.message);

        if (seedLoanId && outScopeRegionId) {
            await loginAs({
                email: managerOutEmail,
                password: managerPassword,
                label: 'manager-out-scope',
            });

            const outCreateDenied = await api('POST', '/api/payroll/loans', {
                guardId: scopedGuard.id,
                month: '2026-04-01',
                amount: 999,
                status: 'PENDING',
            });
            check('POST /api/payroll/loans as out-scope manager', outCreateDenied.status === 403, `${outCreateDenied.status}`);
            record('/api/payroll/loans POST out-scope manager 403', outCreateDenied.status === 403 ? 'PASS' : 'FAIL', 403, outCreateDenied.status, outCreateDenied.data?.message);

            const outList = await api('GET', `/api/payroll/loans?search=${scopedGuard.parwestId}`);
            const outRows = Array.isArray(outList.data) ? outList.data : [];
            const outSeesGuard = outRows.some((row) => row?.guard?.id === scopedGuard.id);
            const outListPass = outList.status === 200 && !outSeesGuard;
            check('GET /api/payroll/loans as out-scope manager', outListPass, `status=${outList.status}, seesGuard=${outSeesGuard}`);
            record('/api/payroll/loans GET out-scope manager', outListPass ? 'PASS' : 'FAIL', '200 + hidden', `${outList.status} + seesGuard=${outSeesGuard}`, `rows=${outRows.length}`);

            const outPatchDenied = await api('PATCH', `/api/payroll/loans/${seedLoanId}`, { status: 'FINALIZED' });
            check('PATCH /api/payroll/loans/[id] as out-scope manager', outPatchDenied.status === 403, `${outPatchDenied.status}`);
            record('/api/payroll/loans/[id] PATCH out-scope manager 403', outPatchDenied.status === 403 ? 'PASS' : 'FAIL', 403, outPatchDenied.status, outPatchDenied.data?.message);

            await loginAs({
                email: managerInEmail,
                password: managerPassword,
                label: 'manager-in-scope',
            });

            const inCreateAllowed = await api('POST', '/api/payroll/loans', {
                guardId: scopedGuard.id,
                month: '2026-05-01',
                amount: 888,
                status: 'PENDING',
            });
            check('POST /api/payroll/loans as in-scope manager', inCreateAllowed.status === 201, `${inCreateAllowed.status}`);
            record('/api/payroll/loans POST in-scope manager 201', inCreateAllowed.status === 201 ? 'PASS' : 'FAIL', 201, inCreateAllowed.status, inCreateAllowed.data?.id || inCreateAllowed.data?.message);

            const inList = await api('GET', `/api/payroll/loans?search=${scopedGuard.parwestId}`);
            const inRows = Array.isArray(inList.data) ? inList.data : [];
            const inSeesGuard = inRows.some((row) => row?.guard?.id === scopedGuard.id);
            const inListPass = inList.status === 200 && inSeesGuard;
            check('GET /api/payroll/loans as in-scope manager', inListPass, `status=${inList.status}, seesGuard=${inSeesGuard}`);
            record('/api/payroll/loans GET in-scope manager', inListPass ? 'PASS' : 'FAIL', '200 + visible', `${inList.status} + seesGuard=${inSeesGuard}`, `rows=${inRows.length}`);

            const inPatchAllowed = await api('PATCH', `/api/payroll/loans/${seedLoanId}`, { status: 'FINALIZED' });
            check('PATCH /api/payroll/loans/[id] as in-scope manager', inPatchAllowed.status === 200, `${inPatchAllowed.status}`);
            record('/api/payroll/loans/[id] PATCH in-scope manager 200', inPatchAllowed.status === 200 ? 'PASS' : 'FAIL', 200, inPatchAllowed.status, inPatchAllowed.data?.status || inPatchAllowed.data?.message);

            await loginAs({
                email: 'admin@parwestgroup.com',
                password: 'admin123@',
                label: 'admin-restore',
            });
        } else {
            record('/api/payroll manager-scope seed', 'FAIL', 'seed loan + out-scope region', 'missing setup refs', 'Cannot run manager-scope assertions without seeded payroll row and out-scope region.');
        }
    }

    console.log('\n====================================');
    console.log('TEST SUMMARY');
    console.log('====================================');
    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    console.log(`Total: ${total} | Pass: ${passed} | Fail: ${failed}`);
    if (failed > 0) {
        console.log('\nFAILED TESTS:');
        results.filter(r => r.status === 'FAIL').forEach(r => {
            console.log(`  ❌ ${r.route} — expected ${r.expected}, got ${r.actual}. ${r.note}`);
        });
    }

    // Output machine-readable JSON for checklist update
    const output = JSON.stringify({ summary: { total, passed, failed }, results }, null, 2);
    import('fs').then(fs => fs.writeFileSync('/tmp/api-test-results.json', output));
    console.log('\nDetailed results saved to /tmp/api-test-results.json');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
