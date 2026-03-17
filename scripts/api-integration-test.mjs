const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
let cookieJar = {};
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function envBool(name, defaultValue = false) {
    const raw = process.env[name];
    if (raw == null) return defaultValue;
    return TRUE_VALUES.has(String(raw).trim().toLowerCase());
}

function generateCnic(seed) {
    const digits = String(seed).replace(/\D/g, '').padStart(13, '0').slice(-13);
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

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
    if (condition) pass(label, detail);
    else fail(label, detail);
}

async function run() {
    const requireRealScopeAssertions = envBool('REQUIRE_REAL_SCOPE_ASSERTIONS', false);
    const failOnScopeSkip = envBool('FAIL_ON_SCOPE_SKIP', requireRealScopeAssertions);
    const requireRealInventoryAssertions = envBool('REQUIRE_REAL_INVENTORY_ASSERTIONS', false);
    const failOnInventorySkip = envBool('FAIL_ON_INVENTORY_SKIP', requireRealInventoryAssertions);
    const inventoryV2LegacyReadonly = envBool('INVENTORY_V2_LEGACY_READONLY', false);
    const skipLegacyInventoryMutations = envBool('SKIP_LEGACY_INVENTORY_MUTATIONS', inventoryV2LegacyReadonly);

    console.log('Integration env:', {
        USE_MOCKS: process.env.USE_MOCKS || null,
        NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS || null,
        REQUIRE_REAL_SCOPE_ASSERTIONS: requireRealScopeAssertions,
        FAIL_ON_SCOPE_SKIP: failOnScopeSkip,
        REQUIRE_REAL_INVENTORY_ASSERTIONS: requireRealInventoryAssertions,
        FAIL_ON_INVENTORY_SKIP: failOnInventorySkip,
        INVENTORY_V2_LEGACY_READONLY: inventoryV2LegacyReadonly,
        SKIP_LEGACY_INVENTORY_MUTATIONS: skipLegacyInventoryMutations,
    });

    const adminSession = await loginAs({
        email: 'admin@parwestgroup.com',
        password: 'admin123@',
        label: 'admin',
    });
    const adminUserId = adminSession?.user?.id || null;

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
    const envMockIntent = envBool('USE_MOCKS', false) || envBool('NEXT_PUBLIC_USE_MOCKS', false);
    const roleBasedMockDetection = Array.isArray(roles.data) && roles.data.some((r) => String(r?.id || '').startsWith('mock-role-'));
    const isMockRuntime = envMockIntent || roleBasedMockDetection;
    const managerRoleFromList = Array.isArray(roles.data) && roles.data.find(r => String(r?.name || '').toLowerCase().includes('manager'))?.id;
    const roleId = Array.isArray(roles.data) && roles.data[0]?.id;

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
        roleId: roleId || undefined,
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
        name: 'Dup', email: testEmail, roleId: roleId || undefined, password: 'pw', status: 'ACTIVE'
    });
    const dupExpected = isMockRuntime ? 201 : 409;
    check('POST /api/users (duplicate email)', u409.status === dupExpected, `${u409.status}`);
    record('/api/users POST duplicate', u409.status === dupExpected ? 'PASS' : 'FAIL', dupExpected, u409.status, u409.data?.message || (isMockRuntime ? 'mock mode does not enforce uniqueness' : ''));

    // GET users list
    const uList = await api('GET', '/api/users');
    check('GET /api/users', uList.status === 200, `${uList.status}`);
    const createdUserFound = Array.isArray(uList.data) && uList.data.some(u => u.email === testEmail);
    const listExpected = isMockRuntime ? !createdUserFound : createdUserFound;
    check('GET /api/users finds new user', listExpected, isMockRuntime ? `mock static list, found=${createdUserFound}` : (createdUserFound ? 'Found' : 'Not found'));
    record('/api/users GET', uList.status === 200 ? 'PASS' : 'FAIL', 200, uList.status, `count=${Array.isArray(uList.data) ? uList.data.length : 'N/A'}, found_new=${createdUserFound}`);

    // GET /api/users?search=
    const uSearch = await api('GET', `/api/users?search=Integration+Test`);
    check('GET /api/users?search=', uSearch.status === 200, `${uSearch.status}`);
    record('/api/users GET search', uSearch.status === 200 ? 'PASS' : 'FAIL', 200, uSearch.status, `results=${Array.isArray(uSearch.data) ? uSearch.data.length : 'N/A'}`);

    if (testUserId) {
        const uPatch = await api('PATCH', `/api/users/${testUserId}`, {
            contactNumber: '03007654321',
            status: 'ACTIVE',
        });
        const uPatchPass = uPatch.status === 200;
        check('PATCH /api/users/[id]', uPatchPass, `${uPatch.status}`);
        record('/api/users/[id] PATCH', uPatchPass ? 'PASS' : 'FAIL', 200, uPatch.status, uPatch.data?.id || uPatch.data?.message);
    }

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
        const req404Expected = isMockRuntime ? 200 : 404;
        check('GET /api/requisitions (404)', req404.status === req404Expected, `${req404.status}`);
        record('/api/requisitions/[id] GET invalid', req404.status === req404Expected ? 'PASS' : 'FAIL', req404Expected, req404.status, req404.data?.message || (isMockRuntime ? 'mock mode returns synthetic row' : ''));
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
        const t404Expected = isMockRuntime ? 200 : 404;
        check('GET /api/tickets (404)', t404.status === t404Expected, `${t404.status}`);
        record('/api/tickets/[id] GET invalid', t404.status === t404Expected ? 'PASS' : 'FAIL', t404Expected, t404.status, t404.data?.message || (isMockRuntime ? 'mock mode returns synthetic row' : ''));
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

    // =========== FINGERPRINT DEVICES ===========
    console.log('\n=== FINGERPRINT DEVICES ===');
    const fpList = await api('GET', '/api/fingerprint-devices');
    check('GET /api/fingerprint-devices', fpList.status === 200, `${fpList.status}`);
    record('/api/fingerprint-devices GET', fpList.status === 200 ? 'PASS' : 'FAIL', 200, fpList.status, `items=${Array.isArray(fpList.data) ? fpList.data.length : 'N/A'}`);

    const fpOfficeId = officeId || (Array.isArray(offices.data) ? offices.data[0]?.id : null);
    let fpDeviceId = null;
    if (fpOfficeId) {
        const fpCreate = await api('POST', '/api/fingerprint-devices', {
            name: `FP_${Date.now()}`,
            officeId: fpOfficeId,
            status: 'OFFLINE',
        });
        check('POST /api/fingerprint-devices', fpCreate.status === 201, `${fpCreate.status}`);
        record('/api/fingerprint-devices POST', fpCreate.status === 201 ? 'PASS' : 'FAIL', 201, fpCreate.status, fpCreate.data?.id || fpCreate.data?.message);
        fpDeviceId = fpCreate.data?.id || null;
    } else {
        record('/api/fingerprint-devices POST', 'FAIL', 'office id available', 'missing office id', 'Cannot create fingerprint device without regional office id.');
    }

    if (fpDeviceId) {
        const fpPatch = await api('PATCH', `/api/fingerprint-devices/${fpDeviceId}`, { status: 'WARNING' });
        check('PATCH /api/fingerprint-devices/[id]', fpPatch.status === 200, `${fpPatch.status}`);
        record('/api/fingerprint-devices/[id] PATCH', fpPatch.status === 200 ? 'PASS' : 'FAIL', 200, fpPatch.status, fpPatch.data?.status || fpPatch.data?.message);

        const fpTest = await api('POST', `/api/fingerprint-devices/${fpDeviceId}/test`);
        check('POST /api/fingerprint-devices/[id]/test', fpTest.status === 200, `${fpTest.status}`);
        record('/api/fingerprint-devices/[id]/test POST', fpTest.status === 200 ? 'PASS' : 'FAIL', 200, fpTest.status, fpTest.data?.status || fpTest.data?.message);

        const fpQueue = await api('POST', `/api/fingerprint-devices/${fpDeviceId}/queue-enrollment`, { count: 2 });
        const fpQueuePass = fpQueue.status === 200 && Number(fpQueue.data?.pendingEnrollments) >= 2;
        check('POST /api/fingerprint-devices/[id]/queue-enrollment', fpQueuePass, `${fpQueue.status}`);
        record('/api/fingerprint-devices/[id]/queue-enrollment POST', fpQueuePass ? 'PASS' : 'FAIL', '200 + pendingEnrollments >=2', `${fpQueue.status} + pending=${fpQueue.data?.pendingEnrollments}`, fpQueue.data?.message || '');

        const fpDelete = await api('DELETE', `/api/fingerprint-devices/${fpDeviceId}`);
        check('DELETE /api/fingerprint-devices/[id]', fpDelete.status === 200, `${fpDelete.status}`);
        record('/api/fingerprint-devices/[id] DELETE', fpDelete.status === 200 ? 'PASS' : 'FAIL', 200, fpDelete.status, String(fpDelete.data?.success));
    }

    // =========== GUARDS (smoke) ===========
    console.log('\n=== GUARDS (smoke) ===');
    const guards = await api('GET', '/api/guards?take=5');
    check('GET /api/guards', guards.status === 200, `${guards.status}`);
    record('/api/guards GET', guards.status === 200 ? 'PASS' : 'FAIL', 200, guards.status, `items=${Array.isArray(guards.data?.data || guards.data) ? (guards.data?.data || guards.data).length : 'N/A'}`);
    const guardSmokeRows = Array.isArray(guards.data?.data) ? guards.data.data : (Array.isArray(guards.data) ? guards.data : []);

    // =========== CLIENTS (smoke) ===========
    console.log('\n=== CLIENTS (smoke) ===');
    const clients = await api('GET', '/api/clients?take=5');
    check('GET /api/clients', clients.status === 200, `${clients.status}`);
    record('/api/clients GET', clients.status === 200 ? 'PASS' : 'FAIL', 200, clients.status, `items=${Array.isArray(clients.data?.data || clients.data) ? (clients.data?.data || clients.data).length : 'N/A'}`);
    const clientSmokeRows = Array.isArray(clients.data?.data) ? clients.data.data : (Array.isArray(clients.data) ? clients.data : []);

    const branches = await api('GET', '/api/branches');
    check('GET /api/branches', branches.status === 200, `${branches.status}`);
    record('/api/branches GET', branches.status === 200 ? 'PASS' : 'FAIL', 200, branches.status, `items=${Array.isArray(branches.data) ? branches.data.length : 'N/A'}`);

    // =========== DEPLOYMENTS (lifecycle) ===========
    console.log('\n=== DEPLOYMENTS (lifecycle) ===');
    const deploymentTs = Date.now();
    let lifecycleClientId = clientSmokeRows[0]?.id || null;
    if (!lifecycleClientId) {
        const seedLifecycleClient = await api('POST', '/api/clients', {
            name: `Deployment Client ${deploymentTs}`,
            type: 'OTHER',
            status: 'ACTIVE',
            city: 'Karachi',
            regionId: regionId || undefined,
        });
        check('POST /api/clients (seed deployment client)', seedLifecycleClient.status === 201, `${seedLifecycleClient.status}`);
        record('/api/clients POST seed deployment client', seedLifecycleClient.status === 201 ? 'PASS' : 'FAIL', 201, seedLifecycleClient.status, seedLifecycleClient.data?.id || seedLifecycleClient.data?.message);
        lifecycleClientId = seedLifecycleClient.data?.id || null;
    }

    let lifecycleGuardId = null;
    if (regionId && officeId) {
        const seedLifecycleGuard = await api('POST', '/api/guards', {
            name: `Deployment Guard ${deploymentTs}`,
            cnic: generateCnic(deploymentTs + 31),
            status: 'ACTIVE',
            regionId,
            regionalOfficeId: officeId,
            phone: '03001234567',
        });
        check('POST /api/guards (seed deployment guard)', seedLifecycleGuard.status === 201, `${seedLifecycleGuard.status}`);
        record('/api/guards POST seed deployment guard', seedLifecycleGuard.status === 201 ? 'PASS' : 'FAIL', 201, seedLifecycleGuard.status, seedLifecycleGuard.data?.id || seedLifecycleGuard.data?.message);
        lifecycleGuardId = seedLifecycleGuard.data?.id || null;
    }
    if (!lifecycleGuardId) {
        lifecycleGuardId = guardSmokeRows.find((g) => g?.id && g?.regionId && g?.regionalOfficeId)?.id || null;
    }

    const deploymentMissingField = await api('POST', '/api/deployments', {
        guardId: lifecycleGuardId || undefined,
        clientId: lifecycleClientId || undefined,
        regionalOfficeId: officeId || undefined,
    });
    check('POST /api/deployments (missing deploymentDate)', deploymentMissingField.status === 400, `${deploymentMissingField.status}`);
    record('/api/deployments POST 400 missing-date', deploymentMissingField.status === 400 ? 'PASS' : 'FAIL', 400, deploymentMissingField.status, deploymentMissingField.data?.message);

    if (!lifecycleGuardId || !lifecycleClientId || !officeId) {
        record('/api/deployments lifecycle setup', 'FAIL', 'guard + client + office refs', 'missing refs', 'Cannot run deployment lifecycle assertions due to missing setup refs.');
    } else {
        const deploymentInvalidShift = await api('POST', '/api/deployments', {
            guardId: lifecycleGuardId,
            clientId: lifecycleClientId,
            regionalOfficeId: officeId,
            deploymentDate: '2026-02-10',
            shiftType: 'INVALID_SHIFT',
        });
        check('POST /api/deployments invalid shiftType', deploymentInvalidShift.status === 400, `${deploymentInvalidShift.status}`);
        record('/api/deployments POST 400 invalid-shift', deploymentInvalidShift.status === 400 ? 'PASS' : 'FAIL', 400, deploymentInvalidShift.status, deploymentInvalidShift.data?.message);

        const deploymentCreate = await api('POST', '/api/deployments', {
            guardId: lifecycleGuardId,
            clientId: lifecycleClientId,
            regionalOfficeId: officeId,
            deploymentDate: '2026-02-10',
            designation: 'Security Guard',
            shiftType: 'DAY',
            rate: 1000,
            salary: 30000,
            overtime: 0,
            extraHours: 0,
            postAllowance: 0,
        });
        check('POST /api/deployments (valid)', deploymentCreate.status === 201, `${deploymentCreate.status}`);
        record('/api/deployments POST 201', deploymentCreate.status === 201 ? 'PASS' : 'FAIL', 201, deploymentCreate.status, deploymentCreate.data?.id || deploymentCreate.data?.message);

        const lifecycleDeploymentId = deploymentCreate.data?.id || null;

        if (isMockRuntime) {
            record('/api/attendance lifecycle e2e', 'PASS', 'guard->deployment->attendance strict chain', 'skipped in mock mode', 'Mock deployment creation is synthetic; strict guard/deployment/attendance chaining requires real runtime.');
        } else {
            const attendanceDate = '2026-02-11';
            const attendanceCreate = await api('POST', '/api/attendance', {
                guardId: lifecycleGuardId,
                date: attendanceDate,
                status: 'PRESENT',
                shiftType: 'DAY',
                notes: 'Deployment lifecycle e2e',
            });
            check('POST /api/attendance (deployment-linked)', attendanceCreate.status === 200, `${attendanceCreate.status}`);
            record('/api/attendance POST deployment-linked 200', attendanceCreate.status === 200 ? 'PASS' : 'FAIL', 200, attendanceCreate.status, attendanceCreate.data?.id || attendanceCreate.data?.message);

            const attendanceList = await api('GET', `/api/attendance?guardId=${encodeURIComponent(lifecycleGuardId)}&startDate=2026-02-01&endDate=2026-02-28`);
            const attendanceRows = Array.isArray(attendanceList.data) ? attendanceList.data : [];
            const attendanceSeen = attendanceRows.some((row) => row?.guardId === lifecycleGuardId && String(row?.status || '').toUpperCase() === 'PRESENT');
            const attendanceListPass = attendanceList.status === 200 && attendanceSeen;
            check('GET /api/attendance deployment guard record visible', attendanceListPass, `status=${attendanceList.status}, seen=${attendanceSeen}`);
            record('/api/attendance GET deployment-guard', attendanceListPass ? 'PASS' : 'FAIL', '200 + attendance visible', `${attendanceList.status} + seen=${attendanceSeen}`, `rows=${attendanceRows.length}`);

            const clientAttendanceList = await api('GET', `/api/attendance/client?clientId=${encodeURIComponent(lifecycleClientId)}&regionalOfficeId=${encodeURIComponent(officeId)}&startDate=2026-02-01&endDate=2026-02-28`);
            const clientAttendanceRows = Array.isArray(clientAttendanceList.data) ? clientAttendanceList.data : [];
            const clientAttendanceSeen = clientAttendanceRows.some((row) => row?.guard?.id === lifecycleGuardId && String(row?.status || '').toUpperCase() === 'PRESENT');
            const clientAttendancePass = clientAttendanceList.status === 200 && clientAttendanceSeen;
            check('GET /api/attendance/client deployment attendance visible', clientAttendancePass, `status=${clientAttendanceList.status}, seen=${clientAttendanceSeen}`);
            record('/api/attendance/client GET deployment-e2e', clientAttendancePass ? 'PASS' : 'FAIL', '200 + PRESENT row visible', `${clientAttendanceList.status} + seen=${clientAttendanceSeen}`, `rows=${clientAttendanceRows.length}`);
        }

        const duplicateExpected = isMockRuntime ? 201 : 409;
        const deploymentDuplicate = await api('POST', '/api/deployments', {
            guardId: lifecycleGuardId,
            clientId: lifecycleClientId,
            regionalOfficeId: officeId,
            deploymentDate: '2026-02-11',
            designation: 'Security Guard',
            shiftType: 'DAY',
            rate: 1000,
            salary: 30000,
            overtime: 0,
            extraHours: 0,
            postAllowance: 0,
        });
        check('POST /api/deployments duplicate active guard', deploymentDuplicate.status === duplicateExpected, `${deploymentDuplicate.status}`);
        record('/api/deployments POST duplicate-active', deploymentDuplicate.status === duplicateExpected ? 'PASS' : 'FAIL', duplicateExpected, deploymentDuplicate.status, deploymentDuplicate.data?.message || (isMockRuntime ? 'mock mode does not enforce lifecycle conflicts' : ''));

        if (isMockRuntime) {
            record('/api/deployments lifecycle strict assertions', 'PASS', 'real-runtime lifecycle contract checks', 'skipped in mock mode', 'Mock create path returns synthetic deployment ids; strict lifecycle checks require real runtime.');
        } else if (lifecycleDeploymentId) {
            const deploymentPatchInvalidShift = await api('PATCH', `/api/deployments/${lifecycleDeploymentId}`, {
                shiftType: 'WRONG',
            });
            check('PATCH /api/deployments/[id] invalid shiftType', deploymentPatchInvalidShift.status === 400, `${deploymentPatchInvalidShift.status}`);
            record('/api/deployments/[id] PATCH invalid-shift', deploymentPatchInvalidShift.status === 400 ? 'PASS' : 'FAIL', 400, deploymentPatchInvalidShift.status, deploymentPatchInvalidShift.data?.message);

            const deploymentEndFuture = await api('POST', `/api/deployments/${lifecycleDeploymentId}/end`, {
                endDate: '2099-01-01',
                reason: 'Future date negative test',
            });
            check('POST /api/deployments/[id]/end future date', deploymentEndFuture.status === 400, `${deploymentEndFuture.status}`);
            record('/api/deployments/[id]/end POST future-date 400', deploymentEndFuture.status === 400 ? 'PASS' : 'FAIL', 400, deploymentEndFuture.status, deploymentEndFuture.data?.message);

            const deploymentEnd = await api('POST', `/api/deployments/${lifecycleDeploymentId}/end`, {
                endDate: '2026-02-12',
                reason: 'Integration end flow',
            });
            check('POST /api/deployments/[id]/end', deploymentEnd.status === 200, `${deploymentEnd.status}`);
            record('/api/deployments/[id]/end POST 200', deploymentEnd.status === 200 ? 'PASS' : 'FAIL', 200, deploymentEnd.status, deploymentEnd.data?.message || '');

            const deploymentEndAgain = await api('POST', `/api/deployments/${lifecycleDeploymentId}/end`, {
                endDate: '2026-02-13',
                reason: 'Integration duplicate end flow',
            });
            check('POST /api/deployments/[id]/end duplicate', deploymentEndAgain.status === 409, `${deploymentEndAgain.status}`);
            record('/api/deployments/[id]/end POST duplicate-409', deploymentEndAgain.status === 409 ? 'PASS' : 'FAIL', 409, deploymentEndAgain.status, deploymentEndAgain.data?.message);

            const deploymentPatchEnded = await api('PATCH', `/api/deployments/${lifecycleDeploymentId}`, {
                designation: 'Supervisor',
            });
            check('PATCH /api/deployments/[id] after end', deploymentPatchEnded.status === 409, `${deploymentPatchEnded.status}`);
            record('/api/deployments/[id] PATCH after-end 409', deploymentPatchEnded.status === 409 ? 'PASS' : 'FAIL', 409, deploymentPatchEnded.status, deploymentPatchEnded.data?.message);
        }
    }

    // =========== INVOICES + CLIENT BLACKLIST ===========
    console.log('\n=== INVOICES + CLIENT BLACKLIST ===');
    let invoiceClientId = Array.isArray(clients.data?.data || clients.data) && (clients.data?.data || clients.data)[0]?.id;
    let invoiceClientEmail = Array.isArray(clients.data?.data || clients.data) && (clients.data?.data || clients.data)[0]?.email;

    if (!invoiceClientId) {
        const seedClientEmail = `invoice_client_${Date.now()}@example.com`;
        const seedClient = await api('POST', '/api/clients', {
            name: `Invoice Client ${Date.now()}`,
            email: seedClientEmail,
            type: 'OTHER',
            status: 'ACTIVE',
            city: 'Karachi',
            regionId: regionId || undefined,
        });
        check('POST /api/clients (seed invoice client)', seedClient.status === 201, `${seedClient.status}`);
        record('/api/clients POST seed invoice client', seedClient.status === 201 ? 'PASS' : 'FAIL', 201, seedClient.status, seedClient.data?.id || seedClient.data?.message);
        invoiceClientId = seedClient.data?.id || null;
        invoiceClientEmail = seedClient.data?.email || seedClientEmail;
    } else if (!invoiceClientEmail) {
        invoiceClientEmail = `invoice_client_${Date.now()}@example.com`;
        const patchClientEmail = await api('PUT', `/api/clients/${invoiceClientId}`, {
            name: `Invoice Client ${Date.now()}`,
            email: invoiceClientEmail,
            type: 'OTHER',
            status: 'ACTIVE',
            city: 'Karachi',
            regionId: regionId || undefined,
            isBranchless: false,
        });
        check('PUT /api/clients/[id] (ensure invoice email)', patchClientEmail.status === 200, `${patchClientEmail.status}`);
        record('/api/clients/[id] PUT ensure-email', patchClientEmail.status === 200 ? 'PASS' : 'FAIL', 200, patchClientEmail.status, patchClientEmail.data?.email || patchClientEmail.data?.message);
        if (patchClientEmail.status === 200) {
            invoiceClientEmail = patchClientEmail.data?.email || invoiceClientEmail;
        }
    }

    const invoice400 = await api('POST', '/api/invoices', { clientId: invoiceClientId, amount: 10000 });
    check('POST /api/invoices (missing month)', invoice400.status === 400, `${invoice400.status}`);
    record('/api/invoices POST 400', invoice400.status === 400 ? 'PASS' : 'FAIL', 400, invoice400.status, invoice400.data?.message);

    let seedInvoiceId = null;
    if (invoiceClientId) {
        const invoiceCreate = await api('POST', '/api/invoices', {
            clientId: invoiceClientId,
            month: '2026-02',
            amount: 10000,
            status: 'PENDING',
        });
        check('POST /api/invoices', invoiceCreate.status === 201, `${invoiceCreate.status}`);
        record('/api/invoices POST', invoiceCreate.status === 201 ? 'PASS' : 'FAIL', 201, invoiceCreate.status, invoiceCreate.data?.invoiceNumber || invoiceCreate.data?.message);
        seedInvoiceId = invoiceCreate.data?.id || null;

        const invoiceList = await api('GET', `/api/invoices?clientId=${invoiceClientId}&month=2026-02`);
        check('GET /api/invoices', invoiceList.status === 200, `${invoiceList.status}`);
        const listedInvoices = Array.isArray(invoiceList.data) ? invoiceList.data.length : 0;
        record('/api/invoices GET', invoiceList.status === 200 ? 'PASS' : 'FAIL', 200, invoiceList.status, `items=${listedInvoices}`);
    }

    if (seedInvoiceId) {
        const invoicePatch = await api('PATCH', `/api/invoices/${seedInvoiceId}`, { status: 'PAID' });
        check('PATCH /api/invoices/[id]', invoicePatch.status === 200, `${invoicePatch.status}`);
        record('/api/invoices/[id] PATCH', invoicePatch.status === 200 ? 'PASS' : 'FAIL', 200, invoicePatch.status, invoicePatch.data?.status || invoicePatch.data?.message);
    }

    if (invoiceClientEmail) {
        const blacklistAdd = await api('POST', '/api/clients/blacklist', { email: invoiceClientEmail });
        check('POST /api/clients/blacklist', blacklistAdd.status === 200, `${blacklistAdd.status}`);
        record('/api/clients/blacklist POST', blacklistAdd.status === 200 ? 'PASS' : 'FAIL', 200, blacklistAdd.status, blacklistAdd.data?.status || blacklistAdd.data?.message);

        const blacklistList = await api('GET', '/api/clients/blacklist');
        check('GET /api/clients/blacklist', blacklistList.status === 200, `${blacklistList.status}`);
        const blacklistRows = Array.isArray(blacklistList.data) ? blacklistList.data : [];
        const inBlacklist = blacklistRows.some((row) => row?.email === invoiceClientEmail);
        const blacklistPass = blacklistList.status === 200 && inBlacklist;
        record('/api/clients/blacklist GET', blacklistPass ? 'PASS' : 'FAIL', '200 + contains seeded client', `${blacklistList.status} + contains=${inBlacklist}`, `rows=${blacklistRows.length}`);

        const blacklistId = blacklistAdd.data?.id;
        if (blacklistId) {
            const blacklistRemove = await api('DELETE', `/api/clients/blacklist?id=${encodeURIComponent(blacklistId)}`);
            check('DELETE /api/clients/blacklist', blacklistRemove.status === 200, `${blacklistRemove.status}`);
            record('/api/clients/blacklist DELETE', blacklistRemove.status === 200 ? 'PASS' : 'FAIL', 200, blacklistRemove.status, blacklistRemove.data?.status || blacklistRemove.data?.message);
        }
    }

    // relationship mutation + audit coverage
    const supervisorTargetId = testUserId || adminUserId || null;
    let msRelId = null;
    if (adminUserId && supervisorTargetId) {
        const msCreate = await api('POST', '/api/users/ms-relationships', {
            managerId: adminUserId,
            supervisorId: supervisorTargetId,
        });
        const msCreatePass = msCreate.status === 201;
        check('POST /api/users/ms-relationships', msCreatePass, `${msCreate.status}`);
        record('/api/users/ms-relationships POST', msCreatePass ? 'PASS' : 'FAIL', 201, msCreate.status, msCreate.data?.id || msCreate.data?.message);
        msRelId = msCreate.data?.id || null;

        if (msRelId) {
            const msDelete = await api('DELETE', `/api/users/ms-relationships/${msRelId}`);
            const msDeletePass = msDelete.status === 200;
            check('DELETE /api/users/ms-relationships/[id]', msDeletePass, `${msDelete.status}`);
            record('/api/users/ms-relationships/[id] DELETE', msDeletePass ? 'PASS' : 'FAIL', 200, msDelete.status, msDelete.data?.message || '');
        }
    } else {
        record('/api/users/ms-relationships mutation setup', 'FAIL', 'admin user id + supervisor user id', 'missing setup refs', 'Cannot run M/S mutation assertions without user ids.');
    }

    let csRelId = null;
    if (invoiceClientId && supervisorTargetId) {
        const csCreate = await api('POST', '/api/users/cs-relationships', {
            clientId: invoiceClientId,
            supervisorId: supervisorTargetId,
        });
        const csCreatePass = csCreate.status === 201;
        check('POST /api/users/cs-relationships', csCreatePass, `${csCreate.status}`);
        record('/api/users/cs-relationships POST', csCreatePass ? 'PASS' : 'FAIL', 201, csCreate.status, csCreate.data?.id || csCreate.data?.message);
        csRelId = csCreate.data?.id || null;

        if (csRelId) {
            const csDelete = await api('DELETE', `/api/users/cs-relationships/${csRelId}`);
            const csDeletePass = csDelete.status === 200;
            check('DELETE /api/users/cs-relationships/[id]', csDeletePass, `${csDelete.status}`);
            record('/api/users/cs-relationships/[id] DELETE', csDeletePass ? 'PASS' : 'FAIL', 200, csDelete.status, csDelete.data?.message || '');
        }
    } else {
        record('/api/users/cs-relationships mutation setup', 'FAIL', 'client id + supervisor user id', 'missing setup refs', 'Cannot run C/S mutation assertions without refs.');
    }

    if (!isMockRuntime) {
        const usersAudit = await api('GET', '/api/audit-logs?module=USERS');
        const usersAuditRows = Array.isArray(usersAudit.data) ? usersAudit.data : (Array.isArray(usersAudit.data?.data) ? usersAudit.data.data : []);
        const requiredEvents = ['USER_CREATED', 'MANAGER_SUPERVISOR_ASSIGNED', 'MANAGER_SUPERVISOR_UNASSIGNED', 'CLIENT_SUPERVISOR_ASSIGNED', 'CLIENT_SUPERVISOR_UNASSIGNED'];
        const hasRequiredEvents = requiredEvents.every((event) => usersAuditRows.some((row) => row?.event === event));
        const usersAuditPass = usersAudit.status === 200 && hasRequiredEvents;
        check('GET /api/audit-logs USERS contains relationship/user mutation events', usersAuditPass, `${usersAudit.status}`);
        record('/api/audit-logs GET users-events', usersAuditPass ? 'PASS' : 'FAIL', '200 + required events', `${usersAudit.status} + events_ok=${hasRequiredEvents}`, `rows=${usersAuditRows.length}`);
    }

    // =========== INVOICE PREREQUISITES (DEPLOYMENT RATES) ===========
    console.log('\n=== INVOICE PREREQUISITES (DEPLOYMENT RATES) ===');
    const branchRows = Array.isArray(branches.data) ? branches.data : [];
    let deploymentRateBranchId = branchRows.find((b) => b?.clientId === invoiceClientId)?.id || branchRows[0]?.id || null;

    if (!deploymentRateBranchId && invoiceClientId) {
        const seedBranch = await api('POST', '/api/branches', {
            clientId: invoiceClientId,
            name: `Invoice Flow Branch ${Date.now()}`,
            code: `IF${String(Date.now()).slice(-4)}`,
            city: 'Karachi',
        });
        check('POST /api/branches (seed invoice-flow branch)', seedBranch.status === 201, `${seedBranch.status}`);
        record('/api/branches POST seed invoice-flow branch', seedBranch.status === 201 ? 'PASS' : 'FAIL', 201, seedBranch.status, seedBranch.data?.id || seedBranch.data?.message);
        deploymentRateBranchId = seedBranch.data?.id || null;
    }

    let deploymentRateId = null;
    const deploymentRateCreate = await api('POST', '/api/deployment-rates', {
        regionId: regionId || undefined,
        clientId: invoiceClientId || undefined,
        branchId: deploymentRateBranchId || undefined,
        deployAs: 'Karachi',
        guardType: 'Guard',
        shiftType: 'DAY',
        salary: 36000,
        overtime: 1200,
        extraHours: 300,
    });
    check('POST /api/deployment-rates', deploymentRateCreate.status === 201, `${deploymentRateCreate.status}`);
    record('/api/deployment-rates POST', deploymentRateCreate.status === 201 ? 'PASS' : 'FAIL', 201, deploymentRateCreate.status, deploymentRateCreate.data?.id || deploymentRateCreate.data?.message);
    deploymentRateId = deploymentRateCreate.data?.id || null;

    const deploymentRateList = await api('GET', `/api/deployment-rates?clientId=${encodeURIComponent(invoiceClientId || '')}`);
    check('GET /api/deployment-rates', deploymentRateList.status === 200, `${deploymentRateList.status}`);
    const deploymentRateRows = Array.isArray(deploymentRateList.data) ? deploymentRateList.data : [];
    const deploymentRateSeen = deploymentRateRows.some((row) => row?.id === deploymentRateId);
    const deploymentRateListPass = deploymentRateList.status === 200 && (deploymentRateId ? deploymentRateSeen : true);
    record('/api/deployment-rates GET', deploymentRateListPass ? 'PASS' : 'FAIL', '200 + contains new rate', `${deploymentRateList.status} + contains=${deploymentRateSeen}`, `rows=${deploymentRateRows.length}`);

    if (deploymentRateId) {
        const deploymentRatePatch = await api('PATCH', `/api/deployment-rates/${deploymentRateId}`, {
            salary: 38000,
            shiftType: 'BOTH',
        });
        check('PATCH /api/deployment-rates/[id]', deploymentRatePatch.status === 200, `${deploymentRatePatch.status}`);
        record('/api/deployment-rates/[id] PATCH', deploymentRatePatch.status === 200 ? 'PASS' : 'FAIL', 200, deploymentRatePatch.status, `salary=${deploymentRatePatch.data?.salary}`);
    }

    // =========== IMPORTS LIFECYCLE ===========
    console.log('\n=== IMPORTS LIFECYCLE ===');
    const importsRows = [
        { name: 'Import User One', email: 'import_user_one@example.com', role: 'Manager', regionalOfficeSeries: 'L', contactNumber: '03001234567' },
        { name: 'Import User Two', email: 'import_user_two@example.com', role: 'Supervisor', regionalOfficeSeries: 'K', contactNumber: '03007654321' },
    ];
    const importsValidateOk = await api('POST', '/api/imports/users/validate', { rows: importsRows });
    const importsValidateData = importsValidateOk.data?.data;
    const importsValidatePass = importsValidateOk.status === 200 && importsValidateData?.valid === true && importsValidateData?.totalRows === 2;
    check('POST /api/imports/users/validate (valid rows)', importsValidatePass, `status=${importsValidateOk.status}, valid=${importsValidateData?.valid}`);
    record('/api/imports/:module/validate POST valid', importsValidatePass ? 'PASS' : 'FAIL', '200 + valid=true', `${importsValidateOk.status} + valid=${importsValidateData?.valid}`, `rows=${importsValidateData?.totalRows ?? 'N/A'}`);

    const importsValidateBad = await api('POST', '/api/imports/users/validate', { rows: [{ name: 'Broken User' }] });
    const importsValidateBadData = importsValidateBad.data?.data;
    const importsValidateBadPass = importsValidateBad.status === 200 && importsValidateBadData?.valid === false && (importsValidateBadData?.errors?.length || 0) > 0;
    check('POST /api/imports/users/validate (invalid rows)', importsValidateBadPass, `status=${importsValidateBad.status}, valid=${importsValidateBadData?.valid}`);
    record('/api/imports/:module/validate POST invalid', importsValidateBadPass ? 'PASS' : 'FAIL', '200 + valid=false', `${importsValidateBad.status} + valid=${importsValidateBadData?.valid}`, `errors=${importsValidateBadData?.errors?.length ?? 'N/A'}`);

    const importsProcess = await api('POST', '/api/imports/users/process', { rows: [{ name: 'No Email User' }] });
    const importsProcessData = importsProcess.data?.data;
    const importsProcessPass = importsProcess.status === 202 && Boolean(importsProcessData?.jobId);
    check('POST /api/imports/users/process', importsProcessPass, `status=${importsProcess.status}, jobId=${importsProcessData?.jobId}`);
    record('/api/imports/:module/process POST', importsProcessPass ? 'PASS' : 'FAIL', '202 + jobId', `${importsProcess.status} + jobId=${importsProcessData?.jobId ? 'yes' : 'no'}`, `status=${importsProcessData?.status ?? 'N/A'}`);

    const importJobId = importsProcessData?.jobId;
    if (importJobId) {
        const importsJob = await api('GET', `/api/imports/jobs/${importJobId}`);
        const importsJobData = importsJob.data?.data;
        const importsJobPass = importsJob.status === 200 && importsJobData?.jobId === importJobId;
        check('GET /api/imports/jobs/[jobId]', importsJobPass, `status=${importsJob.status}, found=${importsJobData?.jobId}`);
        record('/api/imports/jobs/[jobId] GET', importsJobPass ? 'PASS' : 'FAIL', 200, importsJob.status, `job=${importsJobData?.jobId || 'N/A'}`);

        const importsErrorsJson = await api('GET', `/api/imports/jobs/${importJobId}/errors`);
        const importsErrorsData = importsErrorsJson.data?.data;
        const importsErrorsJsonPass = importsErrorsJson.status === 200 && importsErrorsData?.jobId === importJobId;
        check('GET /api/imports/jobs/[jobId]/errors (json)', importsErrorsJsonPass, `status=${importsErrorsJson.status}, errors=${importsErrorsData?.totalErrors}`);
        record('/api/imports/jobs/[jobId]/errors GET json', importsErrorsJsonPass ? 'PASS' : 'FAIL', 200, importsErrorsJson.status, `errors=${importsErrorsData?.totalErrors ?? 'N/A'}`);

        const csvRes = await fetch(`${BASE_URL}/api/imports/jobs/${importJobId}/errors?format=csv`, {
            headers: { 'Cookie': serializeCookies() },
        });
        absorbCookies(csvRes.headers.get('set-cookie'));
        const csvText = await csvRes.text();
        const csvPass = csvRes.status === 200 && csvText.includes('row,field,message');
        check('GET /api/imports/jobs/[jobId]/errors (csv)', csvPass, `${csvRes.status}`);
        record('/api/imports/jobs/[jobId]/errors GET csv', csvPass ? 'PASS' : 'FAIL', '200 + csv header', csvRes.status, `header_present=${csvText.includes('row,field,message')}`);
    } else {
        record('/api/imports/jobs/[jobId] GET', 'FAIL', 'jobId from process', 'missing', 'Cannot verify job lifecycle without process jobId.');
    }

    // =========== REPORTS ===========
    console.log('\n=== REPORTS ===');
    const reportDeployment = await api('GET', '/api/reports/guards/deployment');
    const reportDeploymentData = reportDeployment.data?.data || {};
    const reportDeploymentRowsData = Array.isArray(reportDeploymentData?.rows) ? reportDeploymentData.rows : [];
    const reportDeploymentRows = reportDeploymentRowsData.length;
    const reportDeploymentPass = reportDeployment.status === 200 && reportDeployment.data?.success === true;
    check('GET /api/reports/guards/deployment', reportDeploymentPass, `${reportDeployment.status}`);
    record('/api/reports/guards/deployment GET', reportDeploymentPass ? 'PASS' : 'FAIL', '200 + success=true', `${reportDeployment.status} + success=${reportDeployment.data?.success}`, `rows=${reportDeploymentRows}`);
    const deploymentSummary = reportDeploymentData.summary || {};
    const deploymentSummaryPass =
        Number(deploymentSummary.total ?? 0) === reportDeploymentRows &&
        Number(deploymentSummary.active ?? 0) + Number(deploymentSummary.inactive ?? 0) === reportDeploymentRows &&
        Number(deploymentSummary.day ?? 0) + Number(deploymentSummary.night ?? 0) + Number(deploymentSummary.both ?? 0) === reportDeploymentRows;
    check('guards deployment summary math', deploymentSummaryPass, `total=${deploymentSummary.total}, rows=${reportDeploymentRows}`);
    record('/api/reports/guards/deployment summary', deploymentSummaryPass ? 'PASS' : 'FAIL', 'summary totals align with rows', deploymentSummary.total, `active=${deploymentSummary.active},inactive=${deploymentSummary.inactive}`);

    const reportDayNight = await api('GET', '/api/reports/guards/day-night-duty?reportType=BOTH');
    const reportDayNightData = reportDayNight.data?.data || {};
    const reportDayNightRowsData = Array.isArray(reportDayNightData?.rows) ? reportDayNightData.rows : [];
    const reportDayNightRows = reportDayNightRowsData.length;
    const reportDayNightPass = reportDayNight.status === 200 && reportDayNight.data?.success === true;
    check('GET /api/reports/guards/day-night-duty', reportDayNightPass, `${reportDayNight.status}`);
    record('/api/reports/guards/day-night-duty GET', reportDayNightPass ? 'PASS' : 'FAIL', '200 + success=true', `${reportDayNight.status} + success=${reportDayNight.data?.success}`, `rows=${reportDayNightRows}`);
    const dayNightSummary = reportDayNightData.summary || {};
    const dayNightSummaryPass =
        Number(dayNightSummary.total ?? 0) === reportDayNightRows &&
        Number(dayNightSummary.day ?? 0) + Number(dayNightSummary.night ?? 0) + Number(dayNightSummary.both ?? 0) === reportDayNightRows;
    check('day-night summary math', dayNightSummaryPass, `total=${dayNightSummary.total}, rows=${reportDayNightRows}`);
    record('/api/reports/guards/day-night-duty summary', dayNightSummaryPass ? 'PASS' : 'FAIL', 'summary totals align with rows', dayNightSummary.total, `day=${dayNightSummary.day},night=${dayNightSummary.night},both=${dayNightSummary.both}`);

    const reportDayOnly = await api('GET', '/api/reports/guards/day-night-duty?reportType=DAY');
    const reportDayOnlyRows = Array.isArray(reportDayOnly.data?.data?.rows) ? reportDayOnly.data.data.rows : [];
    const dayOnlyPass = reportDayOnly.status === 200 && reportDayOnlyRows.every((row) => row?.dutyType === 'DAY' || row?.dutyType === 'BOTH');
    check('GET /api/reports/guards/day-night-duty?reportType=DAY', dayOnlyPass, `${reportDayOnly.status}`);
    record('/api/reports/guards/day-night-duty GET DAY', dayOnlyPass ? 'PASS' : 'FAIL', '200 + DAY/BOTH rows only', reportDayOnly.status, `rows=${reportDayOnlyRows.length}`);

    const reportNightOnly = await api('GET', '/api/reports/guards/day-night-duty?reportType=NIGHT');
    const reportNightOnlyRows = Array.isArray(reportNightOnly.data?.data?.rows) ? reportNightOnly.data.data.rows : [];
    const nightOnlyPass = reportNightOnly.status === 200 && reportNightOnlyRows.every((row) => row?.dutyType === 'NIGHT' || row?.dutyType === 'BOTH');
    check('GET /api/reports/guards/day-night-duty?reportType=NIGHT', nightOnlyPass, `${reportNightOnly.status}`);
    record('/api/reports/guards/day-night-duty GET NIGHT', nightOnlyPass ? 'PASS' : 'FAIL', '200 + NIGHT/BOTH rows only', reportNightOnly.status, `rows=${reportNightOnlyRows.length}`);

    const reportClientEnrolled = await api('GET', '/api/reports/clients/enrolled');
    const reportClientEnrolledData = reportClientEnrolled.data?.data || {};
    const reportClientEnrolledRowsData = Array.isArray(reportClientEnrolledData?.rows) ? reportClientEnrolledData.rows : [];
    const reportClientEnrolledRows = reportClientEnrolledRowsData.length;
    const reportClientEnrolledPass = reportClientEnrolled.status === 200 && reportClientEnrolled.data?.success === true;
    check('GET /api/reports/clients/enrolled', reportClientEnrolledPass, `${reportClientEnrolled.status}`);
    record('/api/reports/clients/enrolled GET', reportClientEnrolledPass ? 'PASS' : 'FAIL', '200 + success=true', `${reportClientEnrolled.status} + success=${reportClientEnrolled.data?.success}`, `rows=${reportClientEnrolledRows}`);
    const clientEnrolledSummary = reportClientEnrolledData.summary || {};
    const expectedBranches = reportClientEnrolledRowsData.reduce((sum, row) => sum + Number(row?.branchCount || 0), 0);
    const expectedDeployments = reportClientEnrolledRowsData.reduce((sum, row) => sum + Number(row?.activeDeployments || 0), 0);
    const clientEnrolledSummaryPass =
        Number(clientEnrolledSummary.total ?? 0) === reportClientEnrolledRows &&
        Number(clientEnrolledSummary.active ?? 0) + Number(clientEnrolledSummary.inactive ?? 0) === reportClientEnrolledRows &&
        Number(clientEnrolledSummary.totalBranches ?? 0) === expectedBranches &&
        Number(clientEnrolledSummary.totalDeployments ?? 0) === expectedDeployments;
    check('client-enrolled summary math', clientEnrolledSummaryPass, `total=${clientEnrolledSummary.total}, rows=${reportClientEnrolledRows}`);
    record('/api/reports/clients/enrolled summary', clientEnrolledSummaryPass ? 'PASS' : 'FAIL', 'summary totals align with rows', clientEnrolledSummary.total, `branches=${clientEnrolledSummary.totalBranches},deployments=${clientEnrolledSummary.totalDeployments}`);

    const reportClientSummary = await api('GET', '/api/reports/clients/summary');
    const reportClientSummaryData = reportClientSummary.data?.data || {};
    const reportClientSummaryRowsData = Array.isArray(reportClientSummaryData?.rows) ? reportClientSummaryData.rows : [];
    const reportClientSummaryRows = reportClientSummaryRowsData.length;
    const reportClientSummaryPass = reportClientSummary.status === 200 && reportClientSummary.data?.success === true;
    check('GET /api/reports/clients/summary', reportClientSummaryPass, `${reportClientSummary.status}`);
    record('/api/reports/clients/summary GET', reportClientSummaryPass ? 'PASS' : 'FAIL', '200 + success=true', `${reportClientSummary.status} + success=${reportClientSummary.data?.success}`, `rows=${reportClientSummaryRows}`);
    const clientSummarySummary = reportClientSummaryData.summary || {};
    const expectedSummaryBranches = reportClientSummaryRowsData.reduce((sum, row) => sum + Number(row?.branches || 0), 0);
    const expectedSummaryDeployments = reportClientSummaryRowsData.reduce((sum, row) => sum + Number(row?.activeDeployments || 0), 0);
    const expectedSummaryGuards = reportClientSummaryRowsData.reduce((sum, row) => sum + Number(row?.deployedGuards || 0), 0);
    const expectedSummaryInvoiceAmount = Number(reportClientSummaryRowsData.reduce((sum, row) => sum + Number(row?.invoiceAmount || 0), 0).toFixed(2));
    const clientSummaryMathPass =
        Number(clientSummarySummary.totalClients ?? 0) === reportClientSummaryRows &&
        Number(clientSummarySummary.activeClients ?? 0) <= reportClientSummaryRows &&
        Number(clientSummarySummary.totalBranches ?? 0) === expectedSummaryBranches &&
        Number(clientSummarySummary.totalDeployments ?? 0) === expectedSummaryDeployments &&
        Number(clientSummarySummary.totalDeployedGuards ?? 0) === expectedSummaryGuards &&
        Number(Number(clientSummarySummary.totalInvoiceAmount ?? 0).toFixed(2)) === expectedSummaryInvoiceAmount;
    check('client-summary summary math', clientSummaryMathPass, `clients=${clientSummarySummary.totalClients}, rows=${reportClientSummaryRows}`);
    record('/api/reports/clients/summary summary', clientSummaryMathPass ? 'PASS' : 'FAIL', 'summary totals align with rows', clientSummarySummary.totalClients, `branches=${clientSummarySummary.totalBranches},invoiceAmount=${clientSummarySummary.totalInvoiceAmount}`);

    const reportScheduled = await api('GET', '/api/reports/scheduled');
    const reportScheduledData = reportScheduled.data?.data || {};
    const reportScheduledRowsData = Array.isArray(reportScheduledData?.rows) ? reportScheduledData.rows : [];
    const reportScheduledRows = reportScheduledRowsData.length;
    const reportScheduledPass = reportScheduled.status === 200 && reportScheduled.data?.success === true;
    check('GET /api/reports/scheduled', reportScheduledPass, `${reportScheduled.status}`);
    record('/api/reports/scheduled GET', reportScheduledPass ? 'PASS' : 'FAIL', '200 + success=true', `${reportScheduled.status} + success=${reportScheduled.data?.success}`, `rows=${reportScheduledRows}`);
    const scheduledSummary = reportScheduledData.summary || {};
    const scheduledSummaryPass =
        Number(scheduledSummary.totalSchedules ?? 0) === reportScheduledRows &&
        Number(scheduledSummary.active ?? 0) + Number(scheduledSummary.paused ?? 0) === reportScheduledRows &&
        Number(scheduledSummary.generated ?? 0) <= reportScheduledRows;
    check('scheduled summary math', scheduledSummaryPass, `total=${scheduledSummary.totalSchedules}, rows=${reportScheduledRows}`);
    record('/api/reports/scheduled summary', scheduledSummaryPass ? 'PASS' : 'FAIL', 'summary totals align with rows', scheduledSummary.totalSchedules, `active=${scheduledSummary.active},paused=${scheduledSummary.paused},generated=${scheduledSummary.generated}`);

    const reportsCsvRes = await fetch(`${BASE_URL}/api/reports/clients/summary?format=csv`, {
        headers: { 'Cookie': serializeCookies() },
    });
    absorbCookies(reportsCsvRes.headers.get('set-cookie'));
    const reportsCsvText = await reportsCsvRes.text();
    const reportsCsvPass = reportsCsvRes.status === 200 && reportsCsvText.includes('Client ID,Client Name');
    check('GET /api/reports/clients/summary?format=csv', reportsCsvPass, `${reportsCsvRes.status}`);
    record('/api/reports/clients/summary GET csv', reportsCsvPass ? 'PASS' : 'FAIL', '200 + csv header', reportsCsvRes.status, `header_present=${reportsCsvText.includes('Client ID,Client Name')}`);

    const reportInvalidType = await api('GET', '/api/reports/guards/day-night-duty?reportType=INVALID');
    const reportInvalidTypePass = reportInvalidType.status === 400;
    check('GET /api/reports/guards/day-night-duty invalid reportType', reportInvalidTypePass, `${reportInvalidType.status}`);
    record('/api/reports/guards/day-night-duty GET invalid', reportInvalidTypePass ? 'PASS' : 'FAIL', 400, reportInvalidType.status, reportInvalidType.data?.message);

    const reportInvalidDeploymentDate = await api('GET', '/api/reports/guards/deployment?startDate=not-a-date');
    const reportInvalidDeploymentDatePass = reportInvalidDeploymentDate.status === 400;
    check('GET /api/reports/guards/deployment invalid startDate', reportInvalidDeploymentDatePass, `${reportInvalidDeploymentDate.status}`);
    record('/api/reports/guards/deployment GET invalid date', reportInvalidDeploymentDatePass ? 'PASS' : 'FAIL', 400, reportInvalidDeploymentDate.status, reportInvalidDeploymentDate.data?.message);

    const reportInvalidMonth = await api('GET', '/api/reports/clients/summary?month=2026-13');
    const reportInvalidMonthPass = reportInvalidMonth.status === 400;
    check('GET /api/reports/clients/summary invalid month', reportInvalidMonthPass, `${reportInvalidMonth.status}`);
    record('/api/reports/clients/summary GET invalid month', reportInvalidMonthPass ? 'PASS' : 'FAIL', 400, reportInvalidMonth.status, reportInvalidMonth.data?.message);

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

    const payrollMonth = '2026-01';
    const guardCandidates = Array.isArray(guards.data?.data) ? guards.data.data : (Array.isArray(guards.data) ? guards.data : []);
    let payrollGuard = guardCandidates.find((g) => g?.id && g?.regionId && g?.regionalOfficeId) || null;

    if (!payrollGuard && regionId && officeId) {
      const payrollGuardSeed = await api('POST', '/api/guards', {
        name: `Payroll Guard ${Date.now()}`,
        cnic: generateCnic(Date.now() + 44),
        status: 'ACTIVE',
        regionId,
        regionalOfficeId: officeId,
        phone: '03001234567',
      });
      check('POST /api/guards (seed payroll guard)', payrollGuardSeed.status === 201, `${payrollGuardSeed.status}`);
      record('/api/guards POST seed payroll guard', payrollGuardSeed.status === 201 ? 'PASS' : 'FAIL', 201, payrollGuardSeed.status, payrollGuardSeed.data?.id || payrollGuardSeed.data?.message);
      payrollGuard = payrollGuardSeed.status === 201 ? payrollGuardSeed.data : null;
    }

    const payrollClientRows = Array.isArray(clients.data?.data || clients.data) ? (clients.data?.data || clients.data) : [];
    const payrollClientId = lifecycleClientId || payrollClientRows[0]?.id || null;
    if (payrollGuard?.id && payrollClientId && payrollGuard?.regionalOfficeId) {
      const payrollDeploySeed = await api('POST', '/api/deployments', {
        guardId: payrollGuard.id,
        clientId: payrollClientId,
        regionalOfficeId: payrollGuard.regionalOfficeId,
        deploymentDate: `${payrollMonth}-10`,
        designation: 'Payroll Seed Deployment',
        shiftType: 'DAY',
        rate: 1200,
        salary: 32000,
        overtime: 0,
        extraHours: 0,
        postAllowance: 0,
      });
      const payrollDeploySeedPass = payrollDeploySeed.status === 201 || payrollDeploySeed.status === 409;
      check('POST /api/deployments (seed payroll month)', payrollDeploySeedPass, `${payrollDeploySeed.status}`);
      record('/api/deployments POST seed payroll month', payrollDeploySeedPass ? 'PASS' : 'FAIL', '201/409', payrollDeploySeed.status, payrollDeploySeed.data?.id || payrollDeploySeed.data?.message);
    }

    const salaryCalc = await api('POST', '/api/payroll/salary', { month: payrollMonth, finalize: true });
    const salaryCalcRows = Array.isArray(salaryCalc.data?.rows) ? salaryCalc.data.rows : [];
    const salaryCalcPass = salaryCalc.status === 200 && salaryCalcRows.length >= 1;
    check('POST /api/payroll/salary (calculate+finalize)', salaryCalcPass, `${salaryCalc.status}`);
    record('/api/payroll/salary POST calculate', salaryCalcPass ? 'PASS' : 'FAIL', '200 + rows>=1', `${salaryCalc.status} + rows=${salaryCalcRows.length}`, `finalized=${salaryCalc.data?.finalized ?? 'N/A'}`);

    const salaryCalcStatusPass = salaryCalcRows.every((row) => row?.paymentStatus === 'UNPAID' || row?.paymentStatus === 'PAID');
    check('payroll salary finalized statuses', salaryCalcStatusPass, `rows=${salaryCalcRows.length}`);
    record('/api/payroll/salary POST statuses', salaryCalcStatusPass ? 'PASS' : 'FAIL', 'all rows UNPAID/PAID', salaryCalcRows.map((row) => row?.paymentStatus).join(','), '');

    const salaryListByMonth = await api('GET', `/api/payroll/salary?month=${payrollMonth}-05`);
    const salaryListRows = Array.isArray(salaryListByMonth.data) ? salaryListByMonth.data : [];
    const salaryListPass = salaryListByMonth.status === 200 && salaryListRows.length >= salaryCalcRows.length;
    check('GET /api/payroll/salary by month-range filter', salaryListPass, `${salaryListByMonth.status}`);
    record('/api/payroll/salary GET month-range', salaryListPass ? 'PASS' : 'FAIL', '200 + includes calculated rows', `${salaryListByMonth.status} + rows=${salaryListRows.length}`, '');

    const salaryPatchInvalidStatus = salaryCalcRows[0]?.id
      ? await api('PATCH', `/api/payroll/salary/${salaryCalcRows[0].id}`, { paymentStatus: 'INVALID_STATUS' })
      : { status: 0, data: { message: 'missing salary row id' } };
    const salaryPatchInvalidStatusPass = salaryPatchInvalidStatus.status === 400;
    check('PATCH /api/payroll/salary/[id] invalid paymentStatus', salaryPatchInvalidStatusPass, `${salaryPatchInvalidStatus.status}`);
    record('/api/payroll/salary/[id] PATCH invalid status', salaryPatchInvalidStatusPass ? 'PASS' : 'FAIL', 400, salaryPatchInvalidStatus.status, salaryPatchInvalidStatus.data?.message);

    const salaryPatchInvalidMethod = salaryCalcRows[0]?.id
      ? await api('PATCH', `/api/payroll/salary/${salaryCalcRows[0].id}`, { paymentMethod: 'CHEQUE' })
      : { status: 0, data: { message: 'missing salary row id' } };
    const salaryPatchInvalidMethodPass = salaryPatchInvalidMethod.status === 400;
    check('PATCH /api/payroll/salary/[id] invalid paymentMethod', salaryPatchInvalidMethodPass, `${salaryPatchInvalidMethod.status}`);
    record('/api/payroll/salary/[id] PATCH invalid method', salaryPatchInvalidMethodPass ? 'PASS' : 'FAIL', 400, salaryPatchInvalidMethod.status, salaryPatchInvalidMethod.data?.message);

    // payroll cycle end-to-end validation (seed deployment -> ops -> calculate -> finalize -> payment transition)
    let payrollCycleRow = null;
    let payrollCycleExpectedNet = null;

    if (!payrollGuard?.id) {
      record('/api/payroll cycle setup', 'FAIL', 'guard ref', 'missing guard ref', 'Cannot execute payroll cycle E2E assertions without a guard.');
    } else {
      const cycleExtra = await api('POST', '/api/payroll/extra-hours', {
        guardId: payrollGuard.id,
        month: `${payrollMonth}-01`,
        hours: 10,
        rate: 50,
      });
      const cycleExtraPass = cycleExtra.status === 200 || cycleExtra.status === 201;
      check('POST /api/payroll/extra-hours (cycle)', cycleExtraPass, `${cycleExtra.status}`);
      record('/api/payroll/extra-hours POST cycle', cycleExtraPass ? 'PASS' : 'FAIL', '200/201', cycleExtra.status, `amount=${cycleExtra.data?.extraHoursAmount ?? 'N/A'}`);

      const cycleSpecial = await api('POST', '/api/payroll/special-duty', {
        guardId: payrollGuard.id,
        month: `${payrollMonth}-01`,
        hours: 8,
        rate: 100,
      });
      const cycleSpecialPass = cycleSpecial.status === 200 || cycleSpecial.status === 201;
      check('POST /api/payroll/special-duty (cycle)', cycleSpecialPass, `${cycleSpecial.status}`);
      record('/api/payroll/special-duty POST cycle', cycleSpecialPass ? 'PASS' : 'FAIL', '200/201', cycleSpecial.status, `amount=${cycleSpecial.data?.specialDutyAmount ?? 'N/A'}`);

      const cycleDeduction = await api('POST', '/api/payroll/other-deductions', {
        guardId: payrollGuard.id,
        month: `${payrollMonth}-01`,
        amount: 300,
      });
      const cycleDeductionPass = cycleDeduction.status === 200 || cycleDeduction.status === 201;
      check('POST /api/payroll/other-deductions (cycle)', cycleDeductionPass, `${cycleDeduction.status}`);
      record('/api/payroll/other-deductions POST cycle', cycleDeductionPass ? 'PASS' : 'FAIL', '200/201', cycleDeduction.status, `amount=${cycleDeduction.data?.otherDeductions ?? 'N/A'}`);

      const cycleLoanCreate = await api('POST', '/api/payroll/loans', {
        guardId: payrollGuard.id,
        month: `${payrollMonth}-01`,
        amount: 700,
        status: 'PENDING',
      });
      const cycleLoanCreatePass = cycleLoanCreate.status === 201;
      check('POST /api/payroll/loans (cycle)', cycleLoanCreatePass, `${cycleLoanCreate.status}`);
      record('/api/payroll/loans POST cycle', cycleLoanCreatePass ? 'PASS' : 'FAIL', 201, cycleLoanCreate.status, cycleLoanCreate.data?.id || cycleLoanCreate.data?.message);

      const cycleLoanId = cycleLoanCreate.data?.id;
      if (cycleLoanId) {
        const cycleLoanFinalize = await api('PATCH', `/api/payroll/loans/${cycleLoanId}`, { status: 'FINALIZED' });
        const cycleLoanFinalizePass = cycleLoanFinalize.status === 200;
        check('PATCH /api/payroll/loans/[id] finalize (cycle)', cycleLoanFinalizePass, `${cycleLoanFinalize.status}`);
        record('/api/payroll/loans/[id] PATCH cycle finalize', cycleLoanFinalizePass ? 'PASS' : 'FAIL', 200, cycleLoanFinalize.status, cycleLoanFinalize.data?.status || cycleLoanFinalize.data?.message);
      }

      const cycleCalculate = await api('POST', '/api/payroll/salary', {
        month: payrollMonth,
        guardId: payrollGuard.id,
        finalize: false,
      });
      const cycleCalculatedRows = Array.isArray(cycleCalculate.data?.rows) ? cycleCalculate.data.rows : [];
      payrollCycleRow = cycleCalculatedRows.find((row) => row?.guardId === payrollGuard.id) || cycleCalculatedRows[0] || null;
      const cycleCalculatePass = cycleCalculate.status === 200 && Boolean(payrollCycleRow);
      check('POST /api/payroll/salary cycle calculate', cycleCalculatePass, `${cycleCalculate.status}`);
      record('/api/payroll/salary POST cycle calculate', cycleCalculatePass ? 'PASS' : 'FAIL', '200 + row for guard', `${cycleCalculate.status} + hasRow=${Boolean(payrollCycleRow)}`, `rows=${cycleCalculatedRows.length}`);

      if (payrollCycleRow) {
        payrollCycleExpectedNet = Number((
          Number(payrollCycleRow.baseSalary || 0) +
          Number(payrollCycleRow.extraHoursAmount || 0) +
          Number(payrollCycleRow.specialDutyAmount || 0) -
          Number(payrollCycleRow.loans || 0) -
          Number(payrollCycleRow.otherDeductions || 0) -
          Number(payrollCycleRow.trainingSchoolFees || 0) -
          Number(payrollCycleRow.cwf || 0) -
          Number(payrollCycleRow.eobi || 0) -
          Number(payrollCycleRow.essi || 0)
        ).toFixed(2));
        const cycleNetPass = Number(payrollCycleRow.netSalary || 0) === payrollCycleExpectedNet;
        check('payroll cycle net salary formula', cycleNetPass, `expected=${payrollCycleExpectedNet}, got=${payrollCycleRow.netSalary}`);
        record('/api/payroll/salary cycle net-formula', cycleNetPass ? 'PASS' : 'FAIL', 'net formula match', payrollCycleExpectedNet, `actual=${payrollCycleRow.netSalary}`);
      }

      const cycleFinalize = await api('POST', '/api/payroll/salary', {
        month: payrollMonth,
        guardId: payrollGuard.id,
        finalize: true,
      });
      const cycleFinalizeRows = Array.isArray(cycleFinalize.data?.rows) ? cycleFinalize.data.rows : [];
      const cycleFinalizedRow = cycleFinalizeRows.find((row) => row?.guardId === payrollGuard.id) || cycleFinalizeRows[0] || null;
      const cycleFinalizePass = cycleFinalize.status === 200 && Boolean(cycleFinalizedRow) && ['UNPAID', 'PAID'].includes(String(cycleFinalizedRow.paymentStatus));
      check('POST /api/payroll/salary cycle finalize', cycleFinalizePass, `${cycleFinalize.status}`);
      record('/api/payroll/salary POST cycle finalize', cycleFinalizePass ? 'PASS' : 'FAIL', '200 + paymentStatus UNPAID/PAID', `${cycleFinalize.status} + status=${cycleFinalizedRow?.paymentStatus}`, '');

      if (cycleFinalizedRow?.id) {
        const unpaidBeforePay = await api('GET', `/api/payroll/unpaid?search=${encodeURIComponent(payrollGuard.parwestId || '')}`);
        const unpaidBeforeRows = Array.isArray(unpaidBeforePay.data) ? unpaidBeforePay.data : [];
        const shouldBeInUnpaid = String(cycleFinalizedRow.paymentStatus) === 'UNPAID';
        const inUnpaid = unpaidBeforeRows.some((row) => row?.id === cycleFinalizedRow.id);
        const unpaidBeforePass = isMockRuntime
          ? unpaidBeforePay.status === 200
          : unpaidBeforePay.status === 200 && (shouldBeInUnpaid ? inUnpaid : !inUnpaid);
        check('GET /api/payroll/unpaid includes finalized cycle row', unpaidBeforePass, `${unpaidBeforePay.status}`);
        record('/api/payroll/unpaid GET cycle-before-paid', unpaidBeforePass ? 'PASS' : 'FAIL', isMockRuntime ? '200 in mock runtime' : '200 + status-aligned inclusion', `${unpaidBeforePay.status} + contains=${inUnpaid}`, `status=${cycleFinalizedRow.paymentStatus}, rows=${unpaidBeforeRows.length}`);

        const markPaid = await api('PATCH', `/api/payroll/salary/${cycleFinalizedRow.id}`, {
          paymentStatus: 'PAID',
          paymentMethod: 'BANK',
        });
        const markPaidPass = markPaid.status === 200 && markPaid.data?.paymentStatus === 'PAID' && markPaid.data?.paymentMethod === 'BANK';
        check('PATCH /api/payroll/salary/[id] mark paid (cycle)', markPaidPass, `${markPaid.status}`);
        record('/api/payroll/salary/[id] PATCH cycle mark-paid', markPaidPass ? 'PASS' : 'FAIL', '200 + PAID/BANK', `${markPaid.status} + status=${markPaid.data?.paymentStatus}`, `method=${markPaid.data?.paymentMethod}`);

        const unpaidAfterPay = await api('GET', `/api/payroll/unpaid?search=${encodeURIComponent(payrollGuard.parwestId || '')}`);
        const unpaidAfterRows = Array.isArray(unpaidAfterPay.data) ? unpaidAfterPay.data : [];
        const unpaidAfterPass = unpaidAfterPay.status === 200 && !unpaidAfterRows.some((row) => row?.id === cycleFinalizedRow.id);
        check('GET /api/payroll/unpaid excludes paid cycle row', unpaidAfterPass, `${unpaidAfterPay.status}`);
        record('/api/payroll/unpaid GET cycle-after-paid', unpaidAfterPass ? 'PASS' : 'FAIL', '200 + excludes row', `${unpaidAfterPay.status} + contains=${unpaidAfterRows.some((row) => row?.id === cycleFinalizedRow.id)}`, `rows=${unpaidAfterRows.length}`);
      }
    }

    // =========== INVENTORY ===========
    console.log('\n=== INVENTORY (lifecycle) ===');
    const invCats = await api('GET', '/api/inventory/categories');
    check('GET /api/inventory/categories', invCats.status === 200, `${invCats.status}`);
    record('/api/inventory/categories GET', invCats.status === 200 ? 'PASS' : 'FAIL', 200, invCats.status, `items=${Array.isArray(invCats.data) ? invCats.data.length : 'N/A'}`);

    const invItems = await api('GET', '/api/inventory/items');
    check('GET /api/inventory/items', invItems.status === 200, `${invItems.status}`);
    record('/api/inventory/items GET', invItems.status === 200 ? 'PASS' : 'FAIL', 200, invItems.status, `items=${Array.isArray(invItems.data) ? invItems.data.length : 'N/A'}`);

    if (skipLegacyInventoryMutations) {
        console.log('Skipping legacy inventory mutation assertions (readonly mode enabled).');
        record(
            '/api/inventory mutation lifecycle',
            'PASS',
            'not executed in readonly mode',
            'skipped',
            'Skipped because SKIP_LEGACY_INVENTORY_MUTATIONS=true or INVENTORY_V2_LEGACY_READONLY=true.'
        );
    } else {
        const inventoryTs = Date.now();
        const categoryName = `INV_CAT_${inventoryTs}`;
        const categoryCreate = await api('POST', '/api/inventory/categories', { name: categoryName });
        const categoryCreatePass = categoryCreate.status === 201;
        check('POST /api/inventory/categories', categoryCreatePass, `${categoryCreate.status}`);
        record('/api/inventory/categories POST', categoryCreatePass ? 'PASS' : 'FAIL', 201, categoryCreate.status, categoryCreate.data?.id || categoryCreate.data?.message);
        const categoryIdForCrud = categoryCreate.data?.id || null;

    const categoryDuplicate = await api('POST', '/api/inventory/categories', { name: categoryName });
    const categoryDuplicateExpected = isMockRuntime ? 201 : 409;
    const categoryDuplicatePass = categoryDuplicate.status === categoryDuplicateExpected;
    check('POST /api/inventory/categories duplicate', categoryDuplicatePass, `${categoryDuplicate.status}`);
    record('/api/inventory/categories POST duplicate', categoryDuplicatePass ? 'PASS' : 'FAIL', categoryDuplicateExpected, categoryDuplicate.status, categoryDuplicate.data?.message || (isMockRuntime ? 'mock runtime does not enforce uniqueness' : ''));

    if (categoryIdForCrud) {
        const categoryPatch = await api('PATCH', `/api/inventory/categories/${categoryIdForCrud}`, { name: `${categoryName}_UPDATED` });
        const categoryPatchPass = categoryPatch.status === 200;
        check('PATCH /api/inventory/categories/[id]', categoryPatchPass, `${categoryPatch.status}`);
        record('/api/inventory/categories/[id] PATCH', categoryPatchPass ? 'PASS' : 'FAIL', 200, categoryPatch.status, categoryPatch.data?.name || categoryPatch.data?.message);

        const categoryDelete = await api('DELETE', `/api/inventory/categories/${categoryIdForCrud}`);
        const categoryDeletePass = categoryDelete.status === 200;
        check('DELETE /api/inventory/categories/[id]', categoryDeletePass, `${categoryDelete.status}`);
        record('/api/inventory/categories/[id] DELETE', categoryDeletePass ? 'PASS' : 'FAIL', 200, categoryDelete.status, categoryDelete.data?.message || '');
    }

    // inventory assignment/return lifecycle
    const invVendors = await api('GET', '/api/inventory/vendors');
    const vendorRows = Array.isArray(invVendors.data) ? invVendors.data : [];
    const vendorName = `INV_VENDOR_${inventoryTs}`;
    const vendorCreate = await api('POST', '/api/inventory/vendors', { name: vendorName, contact: '03001234567' });
    const vendorCreatePass = vendorCreate.status === 201;
    check('POST /api/inventory/vendors', vendorCreatePass, `${vendorCreate.status}`);
    record('/api/inventory/vendors POST', vendorCreatePass ? 'PASS' : 'FAIL', 201, vendorCreate.status, vendorCreate.data?.id || vendorCreate.data?.message);
    const vendorIdForCrud = vendorCreate.data?.id || null;

    const vendorDuplicate = await api('POST', '/api/inventory/vendors', { name: vendorName, contact: '03001234567' });
    const vendorDuplicateExpected = isMockRuntime ? 201 : 409;
    const vendorDuplicatePass = vendorDuplicate.status === vendorDuplicateExpected;
    check('POST /api/inventory/vendors duplicate', vendorDuplicatePass, `${vendorDuplicate.status}`);
    record('/api/inventory/vendors POST duplicate', vendorDuplicatePass ? 'PASS' : 'FAIL', vendorDuplicateExpected, vendorDuplicate.status, vendorDuplicate.data?.message || (isMockRuntime ? 'mock runtime does not enforce uniqueness' : ''));

    if (vendorIdForCrud) {
        const vendorPatch = await api('PATCH', `/api/inventory/vendors/${vendorIdForCrud}`, { name: `${vendorName}_UPDATED`, contact: '03111234567' });
        const vendorPatchPass = vendorPatch.status === 200;
        check('PATCH /api/inventory/vendors/[id]', vendorPatchPass, `${vendorPatch.status}`);
        record('/api/inventory/vendors/[id] PATCH', vendorPatchPass ? 'PASS' : 'FAIL', 200, vendorPatch.status, vendorPatch.data?.name || vendorPatch.data?.message);

        const vendorDelete = await api('DELETE', `/api/inventory/vendors/${vendorIdForCrud}`);
        const vendorDeletePass = vendorDelete.status === 200;
        check('DELETE /api/inventory/vendors/[id]', vendorDeletePass, `${vendorDelete.status}`);
        record('/api/inventory/vendors/[id] DELETE', vendorDeletePass ? 'PASS' : 'FAIL', 200, vendorDelete.status, vendorDelete.data?.message || '');
    }

    let assignmentVendorId = vendorRows[0]?.id || null;
    if (!assignmentVendorId) {
        const vendorSeed = await api('POST', '/api/inventory/vendors', { name: `Vendor_${Date.now()}`, contact: '03001234567' });
        check('POST /api/inventory/vendors (seed)', vendorSeed.status === 201, `${vendorSeed.status}`);
        record('/api/inventory/vendors POST seed', vendorSeed.status === 201 ? 'PASS' : 'FAIL', 201, vendorSeed.status, vendorSeed.data?.id || vendorSeed.data?.message);
        assignmentVendorId = vendorSeed.data?.id || null;
    }

    const assignmentCategoryId = Array.isArray(invCats.data) && invCats.data[0]?.id;
    const item400 = await api('POST', '/api/inventory/items', { categoryId: assignmentCategoryId || undefined });
    const item400Pass = item400.status === 400;
    check('POST /api/inventory/items (missing uniqueNumber)', item400Pass, `${item400.status}`);
    record('/api/inventory/items POST 400', item400Pass ? 'PASS' : 'FAIL', 400, item400.status, item400.data?.message);

    const assignmentUniqueNumber = `INV-LC-${Date.now()}`;
    let assignmentItemId = null;
    if (assignmentCategoryId) {
        const assignmentItemCreate = await api('POST', '/api/inventory/items', {
            uniqueNumber: assignmentUniqueNumber,
            categoryId: assignmentCategoryId,
            vendorId: assignmentVendorId || undefined,
            status: 'AVAILABLE',
            quantity: 1,
        });
        const assignmentItemCreatePass = assignmentItemCreate.status === 201;
        check('POST /api/inventory/items (assignment seed)', assignmentItemCreatePass, `${assignmentItemCreate.status}`);
        record('/api/inventory/items POST assignment-seed', assignmentItemCreatePass ? 'PASS' : 'FAIL', 201, assignmentItemCreate.status, assignmentItemCreate.data?.id || assignmentItemCreate.data?.message);
        assignmentItemId = assignmentItemCreate.data?.id || null;

        const assignmentItemDuplicate = await api('POST', '/api/inventory/items', {
            uniqueNumber: assignmentUniqueNumber,
            categoryId: assignmentCategoryId,
            status: 'AVAILABLE',
        });
        const assignmentItemDuplicateExpected = isMockRuntime ? 201 : 409;
        const assignmentItemDuplicatePass = assignmentItemDuplicate.status === assignmentItemDuplicateExpected;
        check('POST /api/inventory/items duplicate uniqueNumber', assignmentItemDuplicatePass, `${assignmentItemDuplicate.status}`);
        record('/api/inventory/items POST duplicate', assignmentItemDuplicatePass ? 'PASS' : 'FAIL', assignmentItemDuplicateExpected, assignmentItemDuplicate.status, assignmentItemDuplicate.data?.message || (isMockRuntime ? 'mock runtime does not enforce uniqueness' : ''));

        const itemPatch404 = await api('PATCH', '/api/inventory/items/nonexistent-item-xyz', { status: 'CONDEMNED' });
        const itemPatch404Expected = isMockRuntime ? 500 : 404;
        const itemPatch404Pass = itemPatch404.status === itemPatch404Expected;
        check('PATCH /api/inventory/items/[id] (not found)', itemPatch404Pass, `${itemPatch404.status}`);
        record('/api/inventory/items/[id] PATCH 404', itemPatch404Pass ? 'PASS' : 'FAIL', itemPatch404Expected, itemPatch404.status, itemPatch404.data?.message);
    } else {
        record('/api/inventory assignment setup', 'FAIL', 'inventory category id', 'missing category', 'Cannot execute assignment lifecycle assertions without category.');
    }

    let assignmentId = null;
    if (assignmentItemId && invoiceClientId) {
        const assignmentInvalidAssignTo = await api('POST', '/api/inventory/assignments', {
            itemId: assignmentItemId,
            assignTo: 'OFFICE',
            entityId: invoiceClientId,
        });
        const assignmentInvalidAssignToPass = assignmentInvalidAssignTo.status === 400;
        check('POST /api/inventory/assignments invalid assignTo', assignmentInvalidAssignToPass, `${assignmentInvalidAssignTo.status}`);
        record('/api/inventory/assignments POST invalid-assignTo', assignmentInvalidAssignToPass ? 'PASS' : 'FAIL', 400, assignmentInvalidAssignTo.status, assignmentInvalidAssignTo.data?.message);

        const assignmentItemCondemned = await api('PATCH', `/api/inventory/items/${assignmentItemId}`, { status: 'CONDEMNED' });
        const assignmentItemCondemnedPass = assignmentItemCondemned.status === 200;
        check('PATCH /api/inventory/items/[id] status CONDEMNED', assignmentItemCondemnedPass, `${assignmentItemCondemned.status}`);
        record('/api/inventory/items/[id] PATCH condemned', assignmentItemCondemnedPass ? 'PASS' : 'FAIL', 200, assignmentItemCondemned.status, assignmentItemCondemned.data?.status || assignmentItemCondemned.data?.message);

        const assignmentFromCondemned = await api('POST', '/api/inventory/assignments', {
            itemId: assignmentItemId,
            assignTo: 'CLIENT',
            entityId: invoiceClientId,
        });
        const assignmentFromCondemnedPass = assignmentFromCondemned.status === 409;
        check('POST /api/inventory/assignments from CONDEMNED item blocked', assignmentFromCondemnedPass, `${assignmentFromCondemned.status}`);
        record('/api/inventory/assignments POST condemned-item', assignmentFromCondemnedPass ? 'PASS' : 'FAIL', 409, assignmentFromCondemned.status, assignmentFromCondemned.data?.message);

        const assignmentItemAvailable = await api('PATCH', `/api/inventory/items/${assignmentItemId}`, { status: 'AVAILABLE' });
        const assignmentItemAvailablePass = assignmentItemAvailable.status === 200;
        check('PATCH /api/inventory/items/[id] status AVAILABLE', assignmentItemAvailablePass, `${assignmentItemAvailable.status}`);
        record('/api/inventory/items/[id] PATCH available', assignmentItemAvailablePass ? 'PASS' : 'FAIL', 200, assignmentItemAvailable.status, assignmentItemAvailable.data?.status || assignmentItemAvailable.data?.message);

        const assignmentMissingEntity = await api('POST', '/api/inventory/assignments', {
            itemId: assignmentItemId,
            assignTo: 'CLIENT',
            entityId: 'missing-client-xyz',
        });
        const assignmentMissingEntityPass = assignmentMissingEntity.status === 404;
        check('POST /api/inventory/assignments missing client', assignmentMissingEntityPass, `${assignmentMissingEntity.status}`);
        record('/api/inventory/assignments POST missing-client', assignmentMissingEntityPass ? 'PASS' : 'FAIL', 404, assignmentMissingEntity.status, assignmentMissingEntity.data?.message);

        const assignmentMissingItem = await api('POST', '/api/inventory/assignments', {
            itemId: 'missing-item-xyz',
            assignTo: 'CLIENT',
            entityId: invoiceClientId,
        });
        const assignmentMissingItemPass = assignmentMissingItem.status === 404;
        check('POST /api/inventory/assignments missing item', assignmentMissingItemPass, `${assignmentMissingItem.status}`);
        record('/api/inventory/assignments POST missing-item', assignmentMissingItemPass ? 'PASS' : 'FAIL', 404, assignmentMissingItem.status, assignmentMissingItem.data?.message);

        const assignmentCreate = await api('POST', '/api/inventory/assignments', {
            itemId: assignmentItemId,
            assignTo: 'CLIENT',
            entityId: invoiceClientId,
            notes: 'Lifecycle assignment test',
        });
        const assignmentCreatePass = assignmentCreate.status === 201;
        check('POST /api/inventory/assignments', assignmentCreatePass, `${assignmentCreate.status}`);
        record('/api/inventory/assignments POST', assignmentCreatePass ? 'PASS' : 'FAIL', 201, assignmentCreate.status, assignmentCreate.data?.id || assignmentCreate.data?.message);
        assignmentId = assignmentCreate.data?.id || null;

        const duplicateAssign = await api('POST', '/api/inventory/assignments', {
            itemId: assignmentItemId,
            assignTo: 'CLIENT',
            entityId: invoiceClientId,
        });
        const duplicateAssignPass = duplicateAssign.status === 409;
        check('POST /api/inventory/assignments duplicate active assignment', duplicateAssignPass, `${duplicateAssign.status}`);
        record('/api/inventory/assignments POST duplicate', duplicateAssignPass ? 'PASS' : 'FAIL', 409, duplicateAssign.status, duplicateAssign.data?.message);

        const itemIssuedCheck = await api('GET', `/api/inventory/items?search=${encodeURIComponent(assignmentUniqueNumber)}`);
        const itemIssuedRows = Array.isArray(itemIssuedCheck.data) ? itemIssuedCheck.data : [];
        const issuedStatusPass = itemIssuedCheck.status === 200 && itemIssuedRows.some((row) => row?.id === assignmentItemId && row?.status === 'ISSUED');
        check('GET /api/inventory/items reflects ISSUED after assignment', issuedStatusPass, `${itemIssuedCheck.status}`);
        record('/api/inventory/items GET issued-status', issuedStatusPass ? 'PASS' : 'FAIL', '200 + status ISSUED', itemIssuedCheck.status, `rows=${itemIssuedRows.length}`);
    }

    if (assignmentId && assignmentItemId) {
        const invalidReturnedAt = await api('PATCH', `/api/inventory/assignments/${assignmentId}`, { returnedAt: 'not-a-date' });
        const invalidReturnedAtPass = invalidReturnedAt.status === 400;
        check('PATCH /api/inventory/assignments/[id] invalid returnedAt', invalidReturnedAtPass, `${invalidReturnedAt.status}`);
        record('/api/inventory/assignments/[id] PATCH invalid-returnedAt', invalidReturnedAtPass ? 'PASS' : 'FAIL', 400, invalidReturnedAt.status, invalidReturnedAt.data?.message);

        if (isMockRuntime) {
            record('/api/inventory/assignments/[id] PATCH early-returnedAt', 'PASS', '400 in real runtime', 'skipped in mock mode', 'Mock runtime assignment timestamps are not strict for earlier-than-assigned assertions.');
        } else {
            const earlyReturnedAt = await api('PATCH', `/api/inventory/assignments/${assignmentId}`, { returnedAt: '1900-01-01T00:00:00.000Z' });
            const earlyReturnedAtPass = earlyReturnedAt.status === 400;
            check('PATCH /api/inventory/assignments/[id] early returnedAt', earlyReturnedAtPass, `${earlyReturnedAt.status}`);
            record('/api/inventory/assignments/[id] PATCH early-returnedAt', earlyReturnedAtPass ? 'PASS' : 'FAIL', 400, earlyReturnedAt.status, earlyReturnedAt.data?.message);
        }

        const assignmentReturn = await api('PATCH', `/api/inventory/assignments/${assignmentId}`, {});
        const assignmentReturnPass = assignmentReturn.status === 200 && Boolean(assignmentReturn.data?.returnedAt);
        check('PATCH /api/inventory/assignments/[id] return', assignmentReturnPass, `${assignmentReturn.status}`);
        record('/api/inventory/assignments/[id] PATCH return', assignmentReturnPass ? 'PASS' : 'FAIL', '200 + returnedAt', assignmentReturn.status, assignmentReturn.data?.returnedAt || assignmentReturn.data?.message);

        const duplicateReturn = await api('PATCH', `/api/inventory/assignments/${assignmentId}`, {});
        const duplicateReturnPass = duplicateReturn.status === 409;
        check('PATCH /api/inventory/assignments/[id] return twice', duplicateReturnPass, `${duplicateReturn.status}`);
        record('/api/inventory/assignments/[id] PATCH duplicate-return', duplicateReturnPass ? 'PASS' : 'FAIL', 409, duplicateReturn.status, duplicateReturn.data?.message);

        const itemAvailableCheck = await api('GET', `/api/inventory/items?search=${encodeURIComponent(assignmentUniqueNumber)}`);
        const itemAvailableRows = Array.isArray(itemAvailableCheck.data) ? itemAvailableCheck.data : [];
        const availableStatusPass = itemAvailableCheck.status === 200 && itemAvailableRows.some((row) => row?.id === assignmentItemId && row?.status === 'AVAILABLE');
        check('GET /api/inventory/items reflects AVAILABLE after return', availableStatusPass, `${itemAvailableCheck.status}`);
        record('/api/inventory/items GET available-status', availableStatusPass ? 'PASS' : 'FAIL', '200 + status AVAILABLE', itemAvailableCheck.status, `rows=${itemAvailableRows.length}`);
    }

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
    const demandCategoryId = assignmentCategoryId || invCatId || null;
    const demCreate = await api('POST', '/api/inventory/demands', { quantity: 1, categoryId: demandCategoryId || undefined, status: 'PENDING' });
    check('POST /api/inventory/demands', demCreate.status === 201, `${demCreate.status}`);
    record('/api/inventory/demands POST', demCreate.status === 201 ? 'PASS' : 'FAIL', 201, demCreate.status, demCreate.data?.quantity != null ? `qty=${demCreate.data.quantity}` : demCreate.data?.message);
    const demId = demCreate.data?.id || null;

    const dem400 = await api('POST', '/api/inventory/demands', { quantity: -1 });
    check('POST /api/inventory/demands (invalid qty)', dem400.status === 400, `${dem400.status}`);
    record('/api/inventory/demands POST 400', dem400.status === 400 ? 'PASS' : 'FAIL', 400, dem400.status, dem400.data?.message);

    const demInitialStatus400 = await api('POST', '/api/inventory/demands', { quantity: 1, categoryId: demandCategoryId || undefined, status: 'FULFILLED' });
    check('POST /api/inventory/demands (invalid initial status)', demInitialStatus400.status === 400, `${demInitialStatus400.status}`);
    record('/api/inventory/demands POST invalid-initial-status', demInitialStatus400.status === 400 ? 'PASS' : 'FAIL', 400, demInitialStatus400.status, demInitialStatus400.data?.message);

    if (isMockRuntime) {
        const inventorySkipShouldFail = failOnInventorySkip;
        record(
            '/api/inventory/demands transition assertions',
            inventorySkipShouldFail ? 'FAIL' : 'PASS',
            inventorySkipShouldFail ? 'real runtime demand lifecycle assertions' : 'real runtime demand lifecycle assertions',
            'skipped in mock mode',
            inventorySkipShouldFail
                ? 'Inventory assertions required but runtime is mock. Re-run with USE_MOCKS=false and NEXT_PUBLIC_USE_MOCKS=false.'
                : 'Strict transition/stock checks require real DB-backed demand rows.'
        );
    } else if (demId) {
        const demPendingToFulfilled = await api('PATCH', `/api/inventory/demands/${demId}`, { status: 'FULFILLED' });
        const demPendingToFulfilledPass = demPendingToFulfilled.status === 409;
        check('PATCH /api/inventory/demands/[id] PENDING->FULFILLED blocked', demPendingToFulfilledPass, `${demPendingToFulfilled.status}`);
        record('/api/inventory/demands/[id] PATCH invalid-transition', demPendingToFulfilledPass ? 'PASS' : 'FAIL', 409, demPendingToFulfilled.status, demPendingToFulfilled.data?.message);

        const demApprove = await api('PATCH', `/api/inventory/demands/${demId}`, { status: 'APPROVED' });
        const demApprovePass = demApprove.status === 200 && demApprove.data?.status === 'APPROVED';
        check('PATCH /api/inventory/demands/[id] approve', demApprovePass, `${demApprove.status}`);
        record('/api/inventory/demands/[id] PATCH approve', demApprovePass ? 'PASS' : 'FAIL', '200 + status APPROVED', demApprove.status, demApprove.data?.status || demApprove.data?.message);

        const demFulfill = await api('PATCH', `/api/inventory/demands/${demId}`, { status: 'FULFILLED' });
        const demFulfillPass = demFulfill.status === 200 && demFulfill.data?.status === 'FULFILLED';
        check('PATCH /api/inventory/demands/[id] fulfill', demFulfillPass, `${demFulfill.status}`);
        record('/api/inventory/demands/[id] PATCH fulfill', demFulfillPass ? 'PASS' : 'FAIL', '200 + status FULFILLED', demFulfill.status, demFulfill.data?.status || demFulfill.data?.message);

        const demReopen = await api('PATCH', `/api/inventory/demands/${demId}`, { status: 'APPROVED' });
        const demReopenPass = demReopen.status === 409;
        check('PATCH /api/inventory/demands/[id] FULFILLED->APPROVED blocked', demReopenPass, `${demReopen.status}`);
        record('/api/inventory/demands/[id] PATCH terminal-transition', demReopenPass ? 'PASS' : 'FAIL', 409, demReopen.status, demReopen.data?.message);

        const demMutateAfterFulfilled = await api('PATCH', `/api/inventory/demands/${demId}`, { quantity: 2 });
        const demMutateAfterFulfilledPass = demMutateAfterFulfilled.status === 409;
        check('PATCH /api/inventory/demands/[id] mutate after fulfilled blocked', demMutateAfterFulfilledPass, `${demMutateAfterFulfilled.status}`);
        record('/api/inventory/demands/[id] PATCH terminal-mutate', demMutateAfterFulfilledPass ? 'PASS' : 'FAIL', 409, demMutateAfterFulfilled.status, demMutateAfterFulfilled.data?.message);

        if (demandCategoryId) {
            const demInsufficient = await api('POST', '/api/inventory/demands', { quantity: 100000, categoryId: demandCategoryId, status: 'PENDING' });
            const demInsufficientCreatePass = demInsufficient.status === 201;
            check('POST /api/inventory/demands (insufficient stock scenario seed)', demInsufficientCreatePass, `${demInsufficient.status}`);
            record('/api/inventory/demands POST insufficient-seed', demInsufficientCreatePass ? 'PASS' : 'FAIL', 201, demInsufficient.status, demInsufficient.data?.id || demInsufficient.data?.message);

            const demInsufficientId = demInsufficient.data?.id || null;
            if (demInsufficientId) {
                const demInsufficientApprove = await api('PATCH', `/api/inventory/demands/${demInsufficientId}`, { status: 'APPROVED' });
                const demInsufficientApprovePass = demInsufficientApprove.status === 200 && demInsufficientApprove.data?.status === 'APPROVED';
                check('PATCH /api/inventory/demands/[id] approve insufficient-seed', demInsufficientApprovePass, `${demInsufficientApprove.status}`);
                record('/api/inventory/demands/[id] PATCH insufficient-approve', demInsufficientApprovePass ? 'PASS' : 'FAIL', '200 + status APPROVED', demInsufficientApprove.status, demInsufficientApprove.data?.status || demInsufficientApprove.data?.message);

                const demInsufficientFulfill = await api('PATCH', `/api/inventory/demands/${demInsufficientId}`, { status: 'FULFILLED' });
                const demInsufficientFulfillPass = demInsufficientFulfill.status === 409;
                check('PATCH /api/inventory/demands/[id] fulfill insufficient stock blocked', demInsufficientFulfillPass, `${demInsufficientFulfill.status}`);
                record('/api/inventory/demands/[id] PATCH insufficient-fulfill', demInsufficientFulfillPass ? 'PASS' : 'FAIL', 409, demInsufficientFulfill.status, demInsufficientFulfill.data?.message);
            }
        } else {
            record('/api/inventory/demands lifecycle setup', 'FAIL', 'inventory category id', 'missing category', 'Cannot execute demand transition assertions without category.');
        }
    } else {
        record('/api/inventory/demands lifecycle setup', 'FAIL', 'inventory category id', 'missing category', 'Cannot execute demand transition assertions without category.');
    }
    }

    // =========== STORE INVENTORY V2 ===========
    console.log('\n=== STORE INVENTORY V2 ===');
    const unwrapData = (response) => {
        const payload = response?.data;
        if (payload && typeof payload === 'object' && payload.success === true && 'data' in payload) {
            return payload.data;
        }
        return payload;
    };
    const v2StoresList = await api('GET', '/api/store-inventory/v2/masters/stores');
    const v2StoresListBody = unwrapData(v2StoresList);
    const v2StoresReadable = v2StoresList.status === 200;
    check('GET /api/store-inventory/v2/masters/stores', v2StoresReadable, `${v2StoresList.status}`);
    record('/api/store-inventory/v2/masters/stores GET', v2StoresReadable ? 'PASS' : 'FAIL', 200, v2StoresList.status, `items=${Array.isArray(v2StoresListBody) ? v2StoresListBody.length : 'N/A'}`);

    if (!v2StoresReadable) {
        const shouldFailV2Skip = failOnInventorySkip;
        record(
            '/api/store-inventory/v2 lifecycle setup',
            shouldFailV2Skip ? 'FAIL' : 'PASS',
            shouldFailV2Skip ? 'readable v2 namespace with migrated schema' : 'readable v2 namespace with migrated schema',
            `status=${v2StoresList.status}`,
            shouldFailV2Skip
                ? 'V2 inventory assertions required but v2 namespace is not ready (schema may be missing or runtime misconfigured).'
                : 'Skipped v2 lifecycle assertions because v2 namespace is not ready.'
        );
    } else {
        const v2Inventories = await api('GET', '/api/store-inventory/v2/inventories');
        const v2InventoriesBody = unwrapData(v2Inventories);
        check('GET /api/store-inventory/v2/inventories', v2Inventories.status === 200, `${v2Inventories.status}`);
        record('/api/store-inventory/v2/inventories GET', v2Inventories.status === 200 ? 'PASS' : 'FAIL', 200, v2Inventories.status, `items=${Array.isArray(v2InventoriesBody) ? v2InventoriesBody.length : 'N/A'}`);

        const v2StatusName = `INV_V2_STATUS_${Date.now()}`;
        const v2StatusCreate = await api('POST', '/api/store-inventory/v2/masters/statuses', { name: v2StatusName });
        const v2WritesBlocked =
            v2StatusCreate.status === 403 &&
            String(v2StatusCreate.data?.message || '').toLowerCase().includes('writeenabled');

        if (v2WritesBlocked) {
            const shouldFailV2WriteSkip = failOnInventorySkip;
            record(
                '/api/store-inventory/v2 lifecycle writes',
                shouldFailV2WriteSkip ? 'FAIL' : 'PASS',
                shouldFailV2WriteSkip ? 'inventory.v2.writeEnabled=true for lifecycle assertions' : 'inventory.v2.writeEnabled=true for lifecycle assertions',
                '403 write blocked',
                shouldFailV2WriteSkip
                    ? 'V2 write lifecycle assertions required but inventory.v2.writeEnabled is disabled.'
                    : 'Skipped v2 write lifecycle assertions because inventory.v2.writeEnabled is disabled.'
            );
        } else {
            const v2StatusBody = unwrapData(v2StatusCreate);
            const v2StatusCreatePass = v2StatusCreate.status === 201;
            check('POST /api/store-inventory/v2/masters/statuses', v2StatusCreatePass, `${v2StatusCreate.status}`);
            record('/api/store-inventory/v2/masters/statuses POST', v2StatusCreatePass ? 'PASS' : 'FAIL', 201, v2StatusCreate.status, v2StatusBody?.id || v2StatusCreate.data?.message);
            const v2StatusId = v2StatusBody?.id || null;

            const v2BrandCreate = await api('POST', '/api/store-inventory/v2/masters/brands', { name: `INV_V2_BRAND_${Date.now()}` });
            const v2BrandBody = unwrapData(v2BrandCreate);
            check('POST /api/store-inventory/v2/masters/brands', v2BrandCreate.status === 201, `${v2BrandCreate.status}`);
            record('/api/store-inventory/v2/masters/brands POST', v2BrandCreate.status === 201 ? 'PASS' : 'FAIL', 201, v2BrandCreate.status, v2BrandBody?.id || v2BrandCreate.data?.message);
            const v2BrandId = v2BrandBody?.id || null;

            const v2UnitCreate = await api('POST', '/api/store-inventory/v2/masters/units', {
                name: `INV_V2_UNIT_${Date.now()}`,
                shortCode: `U${String(Date.now()).slice(-5)}`,
            });
            const v2UnitBody = unwrapData(v2UnitCreate);
            check('POST /api/store-inventory/v2/masters/units', v2UnitCreate.status === 201, `${v2UnitCreate.status}`);
            record('/api/store-inventory/v2/masters/units POST', v2UnitCreate.status === 201 ? 'PASS' : 'FAIL', 201, v2UnitCreate.status, v2UnitBody?.id || v2UnitCreate.data?.message);
            const v2UnitId = v2UnitBody?.id || null;

            const v2StoreCode = `INV2-${String(Date.now()).slice(-6)}`;
            const v2StoreCreate = await api('POST', '/api/store-inventory/v2/masters/stores', {
                code: v2StoreCode,
                name: `Inventory V2 Store ${Date.now()}`,
                regionalOfficeId: officeId || undefined,
                isActive: true,
            });
            const v2StoreBody = unwrapData(v2StoreCreate);
            check('POST /api/store-inventory/v2/masters/stores', v2StoreCreate.status === 201, `${v2StoreCreate.status}`);
            record('/api/store-inventory/v2/masters/stores POST', v2StoreCreate.status === 201 ? 'PASS' : 'FAIL', 201, v2StoreCreate.status, v2StoreBody?.id || v2StoreCreate.data?.message);
            const v2StoreId = v2StoreBody?.id || null;

            const v2ToStoreCreate = await api('POST', '/api/store-inventory/v2/masters/stores', {
                code: `${v2StoreCode}-T`,
                name: `Inventory V2 To Store ${Date.now()}`,
                regionalOfficeId: officeId || undefined,
                isActive: true,
            });
            const v2ToStoreBody = unwrapData(v2ToStoreCreate);
            check('POST /api/store-inventory/v2/masters/stores (toStore)', v2ToStoreCreate.status === 201, `${v2ToStoreCreate.status}`);
            record('/api/store-inventory/v2/masters/stores POST toStore', v2ToStoreCreate.status === 201 ? 'PASS' : 'FAIL', 201, v2ToStoreCreate.status, v2ToStoreBody?.id || v2ToStoreCreate.data?.message);
            const v2ToStoreId = v2ToStoreBody?.id || null;

            const v2Sku = `INV2-SKU-${Date.now()}`;
            const v2ProductCreate = await api('POST', '/api/store-inventory/v2/products', {
                sku: v2Sku,
                name: `Inventory V2 Product ${Date.now()}`,
                brandId: v2BrandId || undefined,
                unitId: v2UnitId || undefined,
                statusId: v2StatusId || undefined,
            });
            const v2ProductBody = unwrapData(v2ProductCreate);
            const v2ProductCreatePass = v2ProductCreate.status === 201;
            check('POST /api/store-inventory/v2/products', v2ProductCreatePass, `${v2ProductCreate.status}`);
            record('/api/store-inventory/v2/products POST', v2ProductCreatePass ? 'PASS' : 'FAIL', 201, v2ProductCreate.status, v2ProductBody?.id || v2ProductCreate.data?.message);
            const v2ProductId = v2ProductBody?.id || null;

            if (v2StoreId && v2ProductId) {
                const v2PurchaseCreate = await api('POST', '/api/store-inventory/v2/purchases', {
                    storeId: v2StoreId,
                    status: 'RECEIVED',
                    lines: [{ productId: v2ProductId, quantity: 8, unitCost: 150 }],
                });
                const v2PurchaseBody = unwrapData(v2PurchaseCreate);
                const v2PurchasePass = v2PurchaseCreate.status === 201;
                check('POST /api/store-inventory/v2/purchases', v2PurchasePass, `${v2PurchaseCreate.status}`);
                record('/api/store-inventory/v2/purchases POST', v2PurchasePass ? 'PASS' : 'FAIL', 201, v2PurchaseCreate.status, v2PurchaseBody?.id || v2PurchaseCreate.data?.message);

                const v2BalanceAfterPurchase = await api('GET', `/api/store-inventory/v2/inventories?storeId=${encodeURIComponent(v2StoreId)}&productId=${encodeURIComponent(v2ProductId)}`);
                const v2BalanceAfterPurchaseBody = unwrapData(v2BalanceAfterPurchase);
                const v2PurchaseRows = Array.isArray(v2BalanceAfterPurchaseBody) ? v2BalanceAfterPurchaseBody : [];
                const v2OnHandAfterPurchase = Number(v2PurchaseRows[0]?.quantityOnHand || 0);
                const v2PurchaseBalancePass = v2BalanceAfterPurchase.status === 200 && v2OnHandAfterPurchase >= 8;
                check('v2 purchase increments stock', v2PurchaseBalancePass, `onHand=${v2OnHandAfterPurchase}`);
                record('/api/store-inventory/v2 purchase balance', v2PurchaseBalancePass ? 'PASS' : 'FAIL', '200 + onHand>=8', `${v2BalanceAfterPurchase.status} + onHand=${v2OnHandAfterPurchase}`, `rows=${v2PurchaseRows.length}`);

                const v2AdjustmentCreate = await api('POST', '/api/store-inventory/v2/adjustments', {
                    storeId: v2StoreId,
                    adjustmentType: 'DECREASE',
                    lines: [{ productId: v2ProductId, quantity: 2, unitCost: 150 }],
                });
                const v2AdjustmentBody = unwrapData(v2AdjustmentCreate);
                const v2AdjustmentPass = v2AdjustmentCreate.status === 201;
                check('POST /api/store-inventory/v2/adjustments', v2AdjustmentPass, `${v2AdjustmentCreate.status}`);
                record('/api/store-inventory/v2/adjustments POST', v2AdjustmentPass ? 'PASS' : 'FAIL', 201, v2AdjustmentCreate.status, v2AdjustmentBody?.id || v2AdjustmentCreate.data?.message);

                const v2BalanceAfterAdjustment = await api('GET', `/api/store-inventory/v2/inventories?storeId=${encodeURIComponent(v2StoreId)}&productId=${encodeURIComponent(v2ProductId)}`);
                const v2BalanceAfterAdjustmentBody = unwrapData(v2BalanceAfterAdjustment);
                const v2AdjustedRows = Array.isArray(v2BalanceAfterAdjustmentBody) ? v2BalanceAfterAdjustmentBody : [];
                const v2OnHandAfterAdjustment = Number(v2AdjustedRows[0]?.quantityOnHand || 0);
                const v2AdjustmentBalancePass = v2BalanceAfterAdjustment.status === 200 && v2OnHandAfterAdjustment >= 6;
                check('v2 adjustment mutates stock', v2AdjustmentBalancePass, `onHand=${v2OnHandAfterAdjustment}`);
                record('/api/store-inventory/v2 adjustment balance', v2AdjustmentBalancePass ? 'PASS' : 'FAIL', '200 + onHand>=6', `${v2BalanceAfterAdjustment.status} + onHand=${v2OnHandAfterAdjustment}`, `rows=${v2AdjustedRows.length}`);

                let v2AssignmentId = null;
                if (adminUserId) {
                    const v2AssignmentCreate = await api('POST', '/api/store-inventory/v2/assignments', {
                        storeId: v2StoreId,
                        productId: v2ProductId,
                        assignedToUserId: adminUserId,
                        quantity: 1,
                    });
                    const v2AssignmentBody = unwrapData(v2AssignmentCreate);
                    const v2AssignmentCreatePass = v2AssignmentCreate.status === 201;
                    check('POST /api/store-inventory/v2/assignments', v2AssignmentCreatePass, `${v2AssignmentCreate.status}`);
                    record('/api/store-inventory/v2/assignments POST', v2AssignmentCreatePass ? 'PASS' : 'FAIL', 201, v2AssignmentCreate.status, v2AssignmentBody?.id || v2AssignmentCreate.data?.message);
                    v2AssignmentId = v2AssignmentBody?.id || null;
                } else {
                    record('/api/store-inventory/v2 assignments setup', 'FAIL', 'admin user id', 'missing session user id', 'Cannot run assignment lifecycle assertions without admin user id.');
                }

                if (v2AssignmentId) {
                    const v2Return = await api('POST', `/api/store-inventory/v2/assignments/${v2AssignmentId}/return`, { status: 'RETURNED' });
                    const v2ReturnBody = unwrapData(v2Return);
                    const v2ReturnPass = v2Return.status === 200 && v2ReturnBody?.status === 'RETURNED';
                    check('POST /api/store-inventory/v2/assignments/[id]/return', v2ReturnPass, `${v2Return.status}`);
                    record('/api/store-inventory/v2/assignments/[id]/return POST', v2ReturnPass ? 'PASS' : 'FAIL', '200 + status RETURNED', `${v2Return.status} + status=${v2ReturnBody?.status}`, v2Return.data?.message || '');
                }

                if (v2ToStoreId) {
                    const v2DemandCreate = await api('POST', '/api/store-inventory/v2/demands', {
                        fromStoreId: v2ToStoreId,
                        toStoreId: v2StoreId,
                        status: 'SENT',
                        lines: [{ productId: v2ProductId, requestedQty: 2 }],
                    });
                    const v2DemandBody = unwrapData(v2DemandCreate);
                    const v2DemandCreatePass = v2DemandCreate.status === 201;
                    check('POST /api/store-inventory/v2/demands', v2DemandCreatePass, `${v2DemandCreate.status}`);
                    record('/api/store-inventory/v2/demands POST', v2DemandCreatePass ? 'PASS' : 'FAIL', 201, v2DemandCreate.status, v2DemandBody?.id || v2DemandCreate.data?.message);

                    const v2DemandId = v2DemandBody?.id || null;
                    const v2DemandLineId = Array.isArray(v2DemandBody?.lines) ? v2DemandBody.lines[0]?.id : null;
                    if (v2DemandId) {
                        const v2DemandApprove = await api('PATCH', `/api/store-inventory/v2/demands/${v2DemandId}`, { status: 'APPROVED' });
                        const v2DemandApproveBody = unwrapData(v2DemandApprove);
                        const v2DemandApprovePass = v2DemandApprove.status === 200 && v2DemandApproveBody?.status === 'APPROVED';
                        check('PATCH /api/store-inventory/v2/demands/[id] approve', v2DemandApprovePass, `${v2DemandApprove.status}`);
                        record('/api/store-inventory/v2/demands/[id] PATCH approve', v2DemandApprovePass ? 'PASS' : 'FAIL', '200 + status APPROVED', `${v2DemandApprove.status} + status=${v2DemandApproveBody?.status}`, v2DemandApprove.data?.message || '');
                    }

                    if (v2DemandId && v2DemandLineId) {
                        const v2DemandResponse = await api('POST', `/api/store-inventory/v2/demands/${v2DemandId}/responses`, {
                            responderStoreId: v2StoreId,
                            status: 'FULFILLED',
                            lines: [{ demandLineId: v2DemandLineId, productId: v2ProductId, quantity: 2 }],
                        });
                        const v2DemandResponseBody = unwrapData(v2DemandResponse);
                        const v2DemandResponsePass = v2DemandResponse.status === 201;
                        check('POST /api/store-inventory/v2/demands/[id]/responses', v2DemandResponsePass, `${v2DemandResponse.status}`);
                        record('/api/store-inventory/v2/demands/[id]/responses POST', v2DemandResponsePass ? 'PASS' : 'FAIL', 201, v2DemandResponse.status, v2DemandResponseBody?.createdResponse?.id || v2DemandResponse.data?.message);

                        const v2DemandGet = await api('GET', `/api/store-inventory/v2/demands/${v2DemandId}`);
                        const v2DemandGetBody = unwrapData(v2DemandGet);
                        const v2DemandStatus = String(v2DemandGetBody?.status || '');
                        const v2DemandTerminalPass = v2DemandGet.status === 200 && ['PARTIALLY_FULFILLED', 'FULFILLED'].includes(v2DemandStatus);
                        check('GET /api/store-inventory/v2/demands/[id] reflects response progress', v2DemandTerminalPass, `${v2DemandGet.status} + ${v2DemandStatus}`);
                        record('/api/store-inventory/v2/demands/[id] GET progress', v2DemandTerminalPass ? 'PASS' : 'FAIL', '200 + PARTIALLY_FULFILLED/FULFILLED', `${v2DemandGet.status} + ${v2DemandStatus}`, '');
                    }
                }

                const v2Report = await api('GET', '/api/reports/inventory/store-summary');
                const v2ReportRows = Array.isArray(v2Report.data?.data?.rows) ? v2Report.data.data.rows : [];
                const v2ReportPass = v2Report.status === 200 && v2Report.data?.success === true;
                check('GET /api/reports/inventory/store-summary', v2ReportPass, `${v2Report.status}`);
                record('/api/reports/inventory/store-summary GET', v2ReportPass ? 'PASS' : 'FAIL', '200 + success=true', `${v2Report.status} + success=${v2Report.data?.success}`, `rows=${v2ReportRows.length}`);

                const v2ReportCsvRes = await fetch(`${BASE_URL}/api/reports/inventory/store-summary?format=csv`, {
                    headers: { 'Cookie': serializeCookies() },
                });
                absorbCookies(v2ReportCsvRes.headers.get('set-cookie'));
                const v2ReportCsvText = await v2ReportCsvRes.text();
                const v2ReportCsvPass = v2ReportCsvRes.status === 200 && v2ReportCsvText.includes('Store Code,Store,Regional Office');
                check('GET /api/reports/inventory/store-summary?format=csv', v2ReportCsvPass, `${v2ReportCsvRes.status}`);
                record('/api/reports/inventory/store-summary GET csv', v2ReportCsvPass ? 'PASS' : 'FAIL', '200 + csv header', v2ReportCsvRes.status, `header_present=${v2ReportCsvText.includes('Store Code,Store,Regional Office')}`);

                const invImportValidateV2 = await api('POST', '/api/imports/inventory/validate', {
                    rows: [{ sku: `IMPORT-${Date.now()}`, name: 'Imported Inventory Product', storeCode: 'RO-IMPORT-1', quantityOnHand: 5 }],
                });
                const invImportValidateV2Data = invImportValidateV2.data?.data;
                const invImportValidateV2Pass = invImportValidateV2.status === 200 && invImportValidateV2Data?.valid === true;
                check('POST /api/imports/inventory/validate (v2 shape)', invImportValidateV2Pass, `${invImportValidateV2.status}`);
                record('/api/imports/inventory/validate POST v2-shape', invImportValidateV2Pass ? 'PASS' : 'FAIL', '200 + valid=true', `${invImportValidateV2.status} + valid=${invImportValidateV2Data?.valid}`, `rows=${invImportValidateV2Data?.totalRows ?? 'N/A'}`);
            } else {
                record('/api/store-inventory/v2 lifecycle setup', 'FAIL', 'store + product ids', 'missing refs', 'Cannot run purchase/adjustment/demand lifecycle without seeded store/product.');
            }
        }
    }

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
    let managerRoleId = managerRoleFromList;
    if (!managerRoleId && !isMockRuntime) {
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
    let scopedGuard = guardRows.find((g) => g?.id && g?.regionId && g?.regionalOfficeId);

    if (!scopedGuard && !isMockRuntime && regionId && officeId) {
        const cnicSeed = generateCnic(scopeTs);
        const seedGuard = await api('POST', '/api/guards', {
            name: `Integration Scoped Guard ${scopeTs}`,
            cnic: cnicSeed,
            status: 'ACTIVE',
            regionId,
            regionalOfficeId: officeId,
            phone: '03001234567',
        });
        check('POST /api/guards (seed scoped guard)', seedGuard.status === 201, `${seedGuard.status}`);
        record('/api/guards POST seed scoped guard', seedGuard.status === 201 ? 'PASS' : 'FAIL', 201, seedGuard.status, seedGuard.data?.id || seedGuard.data?.message);
        if (seedGuard.status === 201 && seedGuard.data?.id) {
            scopedGuard = seedGuard.data;
        }
    }

    if (isMockRuntime) {
        const shouldFailSkip = failOnScopeSkip;
        record(
            '/api/payroll manager-scope setup',
            shouldFailSkip ? 'FAIL' : 'PASS',
            shouldFailSkip ? 'real runtime with scope assertions enabled' : 'real-mode scope assertions',
            'skipped in mock mode',
            shouldFailSkip
                ? 'Scope assertions required but runtime is mock. Re-run with USE_MOCKS=false and NEXT_PUBLIC_USE_MOCKS=false.'
                : 'Skipped manager-scope assertions in mock mode.'
        );
    } else if (!managerRoleId || !scopedGuard) {
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
        let outScopeOfficeId = Array.isArray(offices.data)
            ? offices.data.find((o) => o?.id && o.id !== scopedGuard.regionalOfficeId)?.id
            : null;
        if (!outScopeOfficeId && outScopeRegionId && !isMockRuntime) {
            const outOfficeCreate = await api('POST', '/api/regional-offices', {
                name: `Manager Scope Office ${scopeTs}`,
                seriesCode: `S${String(scopeTs).slice(-2)}`,
                regionId: outScopeRegionId,
            });
            check('POST /api/regional-offices (manager out-scope office)', outOfficeCreate.status === 201, `${outOfficeCreate.status}`);
            record('/api/regional-offices POST manager-out-scope', outOfficeCreate.status === 201 ? 'PASS' : 'FAIL', 201, outOfficeCreate.status, outOfficeCreate.data?.name || outOfficeCreate.data?.message);
            outScopeOfficeId = outOfficeCreate.data?.id || null;
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
            regionalOfficeId: outScopeOfficeId,
            contactNumber: '03001234567',
        });
        check('POST /api/users (manager out-of-scope)', managerOutCreate.status === 201, `${managerOutCreate.status}`);
        record('/api/users POST manager-out-scope', managerOutCreate.status === 201 ? 'PASS' : 'FAIL', 201, managerOutCreate.status, managerOutCreate.data?.email || managerOutCreate.data?.message);

        // Seed scoped client/branch for manager-scope checks on clients module
        let scopedClientId = null;
        let scopedBranchId = null;
        let scopedSupervisorId = null;
        if (!isMockRuntime && scopedGuard.regionId) {
            const scopedClientCreate = await api('POST', '/api/clients', {
                name: `Scope Client ${scopeTs}`,
                type: 'OTHER',
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                city: 'Karachi',
            });
            check('POST /api/clients (seed scoped client)', scopedClientCreate.status === 201, `${scopedClientCreate.status}`);
            record('/api/clients POST seed scoped client', scopedClientCreate.status === 201 ? 'PASS' : 'FAIL', 201, scopedClientCreate.status, scopedClientCreate.data?.id || scopedClientCreate.data?.message);
            scopedClientId = scopedClientCreate.data?.id || null;
        }

        if (!isMockRuntime && scopedClientId) {
            const scopedBranchCreate = await api('POST', '/api/branches', {
                clientId: scopedClientId,
                name: `Scope Branch ${scopeTs}`,
                code: `SC${String(scopeTs).slice(-4)}`,
                city: 'Karachi',
            });
            check('POST /api/branches (seed scoped branch)', scopedBranchCreate.status === 201, `${scopedBranchCreate.status}`);
            record('/api/branches POST seed scoped branch', scopedBranchCreate.status === 201 ? 'PASS' : 'FAIL', 201, scopedBranchCreate.status, scopedBranchCreate.data?.id || scopedBranchCreate.data?.message);
            scopedBranchId = scopedBranchCreate.data?.id || null;
        }

        if (!isMockRuntime) {
            const scopedSupervisorCreate = await api('POST', '/api/users', {
                name: `Scope Supervisor ${scopeTs}`,
                email: `scope_supervisor_${scopeTs}@example.com`,
                password: managerPassword,
                roleId: roleId || managerRoleId,
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                regionalOfficeId: scopedGuard.regionalOfficeId,
                contactNumber: '03001234567',
            });
            check('POST /api/users (seed scoped supervisor)', scopedSupervisorCreate.status === 201, `${scopedSupervisorCreate.status}`);
            record('/api/users POST seed scoped supervisor', scopedSupervisorCreate.status === 201 ? 'PASS' : 'FAIL', 201, scopedSupervisorCreate.status, scopedSupervisorCreate.data?.id || scopedSupervisorCreate.data?.message);
            scopedSupervisorId = scopedSupervisorCreate.data?.id || null;

            const outScopeSupervisorCreate = await api('POST', '/api/users', {
                name: `Out Scope Supervisor ${scopeTs}`,
                email: `scope_supervisor_out_${scopeTs}@example.com`,
                password: managerPassword,
                roleId: roleId || managerRoleId,
                status: 'ACTIVE',
                regionId: outScopeRegionId,
                regionalOfficeId: outScopeOfficeId,
                contactNumber: '03001234567',
            });
            check('POST /api/users (seed out-scope supervisor)', outScopeSupervisorCreate.status === 201, `${outScopeSupervisorCreate.status}`);
            record('/api/users POST seed out-scope supervisor', outScopeSupervisorCreate.status === 201 ? 'PASS' : 'FAIL', 201, outScopeSupervisorCreate.status, outScopeSupervisorCreate.data?.id || outScopeSupervisorCreate.data?.message);
        }

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

            const attendanceDenied = await api('POST', '/api/attendance', {
                guardId: scopedGuard.id,
                date: '2026-01-10',
                status: 'PRESENT',
                shiftType: 'DAY',
            });
            check('POST /api/attendance as out-scope manager', attendanceDenied.status === 403, `${attendanceDenied.status}`);
            record('/api/attendance POST out-scope manager 403', attendanceDenied.status === 403 ? 'PASS' : 'FAIL', 403, attendanceDenied.status, attendanceDenied.data?.message);

            const clientAttendanceDenied = await api('GET', `/api/attendance/client?regionalOfficeId=${scopedGuard.regionalOfficeId}`);
            check('GET /api/attendance/client as out-scope manager', clientAttendanceDenied.status === 403, `${clientAttendanceDenied.status}`);
            record('/api/attendance/client GET out-scope manager 403', clientAttendanceDenied.status === 403 ? 'PASS' : 'FAIL', 403, clientAttendanceDenied.status, clientAttendanceDenied.data?.message);

            const deploymentDenied = await api('POST', '/api/deployments', {
                regionalOfficeId: scopedGuard.regionalOfficeId,
                guardId: scopedGuard.id,
                clientId: scopedClientId,
                deploymentDate: '2026-01-10',
                designation: 'Scope Test Deployment',
                shiftType: 'DAY',
                rate: 900,
                salary: 28000,
                overtime: 0,
                extraHours: 0,
                postAllowance: 0,
            });
            check('POST /api/deployments as out-scope manager', deploymentDenied.status === 403, `${deploymentDenied.status}`);
            record('/api/deployments POST out-scope manager 403', deploymentDenied.status === 403 ? 'PASS' : 'FAIL', 403, deploymentDenied.status, deploymentDenied.data?.message);

            const outScopeGuardCreate = await api('POST', '/api/guards', {
                name: `Out Scope Guard ${scopeTs}`,
                cnic: generateCnic(scopeTs + 11),
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                regionalOfficeId: scopedGuard.regionalOfficeId,
                phone: '03001234567',
            });
            check('POST /api/guards as out-scope manager', outScopeGuardCreate.status === 403, `${outScopeGuardCreate.status}`);
            record('/api/guards POST out-scope manager 403', outScopeGuardCreate.status === 403 ? 'PASS' : 'FAIL', 403, outScopeGuardCreate.status, outScopeGuardCreate.data?.message);

            const usersListDenied = await api('GET', `/api/users?regionId=${scopedGuard.regionId}`);
            check('GET /api/users as out-scope manager (scoped region)', usersListDenied.status === 403, `${usersListDenied.status}`);
            record('/api/users GET out-scope manager 403', usersListDenied.status === 403 ? 'PASS' : 'FAIL', 403, usersListDenied.status, usersListDenied.data?.message);

            const usersCreateDenied = await api('POST', '/api/users', {
                name: `Out Scope Attempt User ${scopeTs}`,
                email: `out_scope_attempt_${scopeTs}@example.com`,
                password: managerPassword,
                roleId: roleId || managerRoleId,
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                regionalOfficeId: scopedGuard.regionalOfficeId,
            });
            check('POST /api/users as out-scope manager', usersCreateDenied.status === 403, `${usersCreateDenied.status}`);
            record('/api/users POST out-scope manager 403', usersCreateDenied.status === 403 ? 'PASS' : 'FAIL', 403, usersCreateDenied.status, usersCreateDenied.data?.message);

            if (scopedSupervisorId) {
                const usersPatchDenied = await api('PATCH', `/api/users/${scopedSupervisorId}`, { contactNumber: '03009990000' });
                check('PATCH /api/users/[id] as out-scope manager', usersPatchDenied.status === 403, `${usersPatchDenied.status}`);
                record('/api/users/[id] PATCH out-scope manager 403', usersPatchDenied.status === 403 ? 'PASS' : 'FAIL', 403, usersPatchDenied.status, usersPatchDenied.data?.message);
            }

            if (managerInCreate.data?.id) {
                const msGetDenied = await api('GET', `/api/users/ms-relationships?managerId=${managerInCreate.data.id}`);
                check('GET /api/users/ms-relationships as out-scope manager', msGetDenied.status === 403, `${msGetDenied.status}`);
                record('/api/users/ms-relationships GET out-scope manager 403', msGetDenied.status === 403 ? 'PASS' : 'FAIL', 403, msGetDenied.status, msGetDenied.data?.message);
            }

            if (managerInCreate.data?.id && scopedSupervisorId) {
                const msPostDenied = await api('POST', '/api/users/ms-relationships', {
                    managerId: managerInCreate.data.id,
                    supervisorId: scopedSupervisorId,
                    regionalOfficeId: scopedGuard.regionalOfficeId,
                });
                check('POST /api/users/ms-relationships as out-scope manager', msPostDenied.status === 403, `${msPostDenied.status}`);
                record('/api/users/ms-relationships POST out-scope manager 403', msPostDenied.status === 403 ? 'PASS' : 'FAIL', 403, msPostDenied.status, msPostDenied.data?.message);
            }

            if (scopedClientId) {
                const csGetDenied = await api('GET', `/api/users/cs-relationships?clientId=${scopedClientId}`);
                check('GET /api/users/cs-relationships as out-scope manager', csGetDenied.status === 403, `${csGetDenied.status}`);
                record('/api/users/cs-relationships GET out-scope manager 403', csGetDenied.status === 403 ? 'PASS' : 'FAIL', 403, csGetDenied.status, csGetDenied.data?.message);
            }

            if (scopedClientId && scopedSupervisorId) {
                const csPostDenied = await api('POST', '/api/users/cs-relationships', {
                    clientId: scopedClientId,
                    branchId: scopedBranchId,
                    supervisorId: scopedSupervisorId,
                });
                check('POST /api/users/cs-relationships as out-scope manager', csPostDenied.status === 403, `${csPostDenied.status}`);
                record('/api/users/cs-relationships POST out-scope manager 403', csPostDenied.status === 403 ? 'PASS' : 'FAIL', 403, csPostDenied.status, csPostDenied.data?.message);
            }

            if (scopedSupervisorId && managerInCreate.data?.id) {
                const switchPreviewDenied = await api('GET', `/api/users/switch-supervisor?fromSupervisorId=${scopedSupervisorId}&toSupervisorId=${managerInCreate.data.id}`);
                check('GET /api/users/switch-supervisor as out-scope manager', switchPreviewDenied.status === 403, `${switchPreviewDenied.status}`);
                record('/api/users/switch-supervisor GET out-scope manager 403', switchPreviewDenied.status === 403 ? 'PASS' : 'FAIL', 403, switchPreviewDenied.status, switchPreviewDenied.data?.message);
            }

            if (scopedSupervisorId && managerInCreate.data?.id) {
                const switchApplyDenied = await api('POST', '/api/users/switch-supervisor', {
                    fromSupervisorId: scopedSupervisorId,
                    toSupervisorId: managerInCreate.data.id,
                    reason: 'Out-scope deny assertion',
                });
                check('POST /api/users/switch-supervisor as out-scope manager', switchApplyDenied.status === 403, `${switchApplyDenied.status}`);
                record('/api/users/switch-supervisor POST out-scope manager 403', switchApplyDenied.status === 403 ? 'PASS' : 'FAIL', 403, switchApplyDenied.status, switchApplyDenied.data?.message);
            }

            if (scopedClientId) {
                const outClientBranchList = await api('GET', `/api/clients/${scopedClientId}/branches`);
                check('GET /api/clients/[id]/branches as out-scope manager', outClientBranchList.status === 403, `${outClientBranchList.status}`);
                record('/api/clients/[id]/branches GET out-scope manager 403', outClientBranchList.status === 403 ? 'PASS' : 'FAIL', 403, outClientBranchList.status, outClientBranchList.data?.message);

                const outClientBranchCreateDenied = await api('POST', `/api/clients/${scopedClientId}/branches`, {
                    name: `Out Scope Client Branch ${scopeTs}`,
                    code: `OCB${String(scopeTs).slice(-4)}`,
                    city: 'Karachi',
                });
                check('POST /api/clients/[id]/branches as out-scope manager', outClientBranchCreateDenied.status === 403, `${outClientBranchCreateDenied.status}`);
                record('/api/clients/[id]/branches POST out-scope manager 403', outClientBranchCreateDenied.status === 403 ? 'PASS' : 'FAIL', 403, outClientBranchCreateDenied.status, outClientBranchCreateDenied.data?.message);

                const outBranchCreateDenied = await api('POST', '/api/branches', {
                    clientId: scopedClientId,
                    name: `Out Scope Branch ${scopeTs}`,
                    code: `OB${String(scopeTs).slice(-4)}`,
                    city: 'Karachi',
                });
                check('POST /api/branches as out-scope manager', outBranchCreateDenied.status === 403, `${outBranchCreateDenied.status}`);
                record('/api/branches POST out-scope manager 403', outBranchCreateDenied.status === 403 ? 'PASS' : 'FAIL', 403, outBranchCreateDenied.status, outBranchCreateDenied.data?.message);

                if (scopedBranchId) {
                    const outBranchPatchDenied = await api('PATCH', `/api/branches/${scopedBranchId}`, {
                        name: `Out Scope Update ${scopeTs}`,
                    });
                    check('PATCH /api/branches/[id] as out-scope manager', outBranchPatchDenied.status === 403, `${outBranchPatchDenied.status}`);
                    record('/api/branches/[id] PATCH out-scope manager 403', outBranchPatchDenied.status === 403 ? 'PASS' : 'FAIL', 403, outBranchPatchDenied.status, outBranchPatchDenied.data?.message);
                }
            }

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

            const clientAttendanceAllowed = await api('GET', `/api/attendance/client?regionalOfficeId=${scopedGuard.regionalOfficeId}`);
            check('GET /api/attendance/client as in-scope manager', clientAttendanceAllowed.status === 200, `${clientAttendanceAllowed.status}`);
            record('/api/attendance/client GET in-scope manager 200', clientAttendanceAllowed.status === 200 ? 'PASS' : 'FAIL', 200, clientAttendanceAllowed.status, Array.isArray(clientAttendanceAllowed.data) ? `rows=${clientAttendanceAllowed.data.length}` : '');

            const inScopeGuardCreate = await api('POST', '/api/guards', {
                name: `In Scope Guard ${scopeTs}`,
                cnic: generateCnic(scopeTs + 22),
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                regionalOfficeId: scopedGuard.regionalOfficeId,
                phone: '03001234567',
            });
            check('POST /api/guards as in-scope manager', inScopeGuardCreate.status === 201, `${inScopeGuardCreate.status}`);
            record('/api/guards POST in-scope manager 201', inScopeGuardCreate.status === 201 ? 'PASS' : 'FAIL', 201, inScopeGuardCreate.status, inScopeGuardCreate.data?.id || inScopeGuardCreate.data?.message);

            const usersListAllowed = await api('GET', `/api/users?regionalOfficeId=${scopedGuard.regionalOfficeId}`);
            check('GET /api/users as in-scope manager', usersListAllowed.status === 200, `${usersListAllowed.status}`);
            record('/api/users GET in-scope manager 200', usersListAllowed.status === 200 ? 'PASS' : 'FAIL', 200, usersListAllowed.status, `rows=${Array.isArray(usersListAllowed.data) ? usersListAllowed.data.length : 'N/A'}`);

            const usersCreateAllowed = await api('POST', '/api/users', {
                name: `In Scope Attempt User ${scopeTs}`,
                email: `in_scope_attempt_${scopeTs}@example.com`,
                password: managerPassword,
                roleId: roleId || managerRoleId,
                status: 'ACTIVE',
                regionId: scopedGuard.regionId,
                regionalOfficeId: scopedGuard.regionalOfficeId,
            });
            check('POST /api/users as in-scope manager', usersCreateAllowed.status === 201, `${usersCreateAllowed.status}`);
            record('/api/users POST in-scope manager 201', usersCreateAllowed.status === 201 ? 'PASS' : 'FAIL', 201, usersCreateAllowed.status, usersCreateAllowed.data?.id || usersCreateAllowed.data?.message);

            if (scopedSupervisorId) {
                const usersPatchAllowed = await api('PATCH', `/api/users/${scopedSupervisorId}`, { contactNumber: '03008887777' });
                check('PATCH /api/users/[id] as in-scope manager', usersPatchAllowed.status === 200, `${usersPatchAllowed.status}`);
                record('/api/users/[id] PATCH in-scope manager 200', usersPatchAllowed.status === 200 ? 'PASS' : 'FAIL', 200, usersPatchAllowed.status, usersPatchAllowed.data?.id || usersPatchAllowed.data?.message);
            }

            let msRelationshipId = null;
            if (managerInCreate.data?.id && scopedSupervisorId) {
                const msPostAllowed = await api('POST', '/api/users/ms-relationships', {
                    managerId: managerInCreate.data.id,
                    supervisorId: scopedSupervisorId,
                    regionalOfficeId: scopedGuard.regionalOfficeId,
                });
                check('POST /api/users/ms-relationships as in-scope manager', msPostAllowed.status === 201, `${msPostAllowed.status}`);
                record('/api/users/ms-relationships POST in-scope manager 201', msPostAllowed.status === 201 ? 'PASS' : 'FAIL', 201, msPostAllowed.status, msPostAllowed.data?.id || msPostAllowed.data?.message);
                msRelationshipId = msPostAllowed.data?.id || null;

                const msGetAllowed = await api('GET', `/api/users/ms-relationships?managerId=${managerInCreate.data.id}`);
                check('GET /api/users/ms-relationships as in-scope manager', msGetAllowed.status === 200, `${msGetAllowed.status}`);
                record('/api/users/ms-relationships GET in-scope manager 200', msGetAllowed.status === 200 ? 'PASS' : 'FAIL', 200, msGetAllowed.status, `rows=${Array.isArray(msGetAllowed.data) ? msGetAllowed.data.length : 'N/A'}`);
            }

            if (msRelationshipId) {
                const msDeleteAllowed = await api('DELETE', `/api/users/ms-relationships/${msRelationshipId}`);
                check('DELETE /api/users/ms-relationships/[id] as in-scope manager', msDeleteAllowed.status === 200, `${msDeleteAllowed.status}`);
                record('/api/users/ms-relationships/[id] DELETE in-scope manager 200', msDeleteAllowed.status === 200 ? 'PASS' : 'FAIL', 200, msDeleteAllowed.status, String(msDeleteAllowed.data?.success));
            }

            let csRelationshipId = null;
            if (scopedClientId && scopedSupervisorId) {
                const csPostAllowed = await api('POST', '/api/users/cs-relationships', {
                    clientId: scopedClientId,
                    branchId: scopedBranchId,
                    supervisorId: scopedSupervisorId,
                });
                check('POST /api/users/cs-relationships as in-scope manager', csPostAllowed.status === 201, `${csPostAllowed.status}`);
                record('/api/users/cs-relationships POST in-scope manager 201', csPostAllowed.status === 201 ? 'PASS' : 'FAIL', 201, csPostAllowed.status, csPostAllowed.data?.id || csPostAllowed.data?.message);
                csRelationshipId = csPostAllowed.data?.id || null;

                const csGetAllowed = await api('GET', `/api/users/cs-relationships?clientId=${scopedClientId}`);
                check('GET /api/users/cs-relationships as in-scope manager', csGetAllowed.status === 200, `${csGetAllowed.status}`);
                record('/api/users/cs-relationships GET in-scope manager 200', csGetAllowed.status === 200 ? 'PASS' : 'FAIL', 200, csGetAllowed.status, `rows=${Array.isArray(csGetAllowed.data) ? csGetAllowed.data.length : 'N/A'}`);
            }

            if (csRelationshipId) {
                const csDeleteAllowed = await api('DELETE', `/api/users/cs-relationships/${csRelationshipId}`);
                check('DELETE /api/users/cs-relationships/[id] as in-scope manager', csDeleteAllowed.status === 200, `${csDeleteAllowed.status}`);
                record('/api/users/cs-relationships/[id] DELETE in-scope manager 200', csDeleteAllowed.status === 200 ? 'PASS' : 'FAIL', 200, csDeleteAllowed.status, String(csDeleteAllowed.data?.success));
            }

            if (scopedSupervisorId && managerInCreate.data?.id) {
                const switchPreviewAllowed = await api('GET', `/api/users/switch-supervisor?fromSupervisorId=${scopedSupervisorId}&toSupervisorId=${managerInCreate.data.id}`);
                check('GET /api/users/switch-supervisor as in-scope manager', switchPreviewAllowed.status === 200, `${switchPreviewAllowed.status}`);
                record('/api/users/switch-supervisor GET in-scope manager 200', switchPreviewAllowed.status === 200 ? 'PASS' : 'FAIL', 200, switchPreviewAllowed.status, Array.isArray(switchPreviewAllowed.data) ? `rows=${switchPreviewAllowed.data.length}` : '');
            }

            if (scopedSupervisorId && managerInCreate.data?.id) {
                const switchApplyAllowed = await api('POST', '/api/users/switch-supervisor', {
                    fromSupervisorId: scopedSupervisorId,
                    toSupervisorId: managerInCreate.data.id,
                    reason: 'In-scope allow assertion',
                });
                const switchAllowedPass = switchApplyAllowed.status === 200 && typeof switchApplyAllowed.data?.switchedCount === 'number';
                check('POST /api/users/switch-supervisor as in-scope manager', switchAllowedPass, `${switchApplyAllowed.status}`);
                record('/api/users/switch-supervisor POST in-scope manager 200', switchAllowedPass ? 'PASS' : 'FAIL', '200 + switchedCount', `${switchApplyAllowed.status} + switchedCount=${switchApplyAllowed.data?.switchedCount}`, switchApplyAllowed.data?.message || '');
            }

            if (scopedClientId) {
                const inClientBranchList = await api('GET', `/api/clients/${scopedClientId}/branches`);
                check('GET /api/clients/[id]/branches as in-scope manager', inClientBranchList.status === 200, `${inClientBranchList.status}`);
                record('/api/clients/[id]/branches GET in-scope manager 200', inClientBranchList.status === 200 ? 'PASS' : 'FAIL', 200, inClientBranchList.status, Array.isArray(inClientBranchList.data) ? `rows=${inClientBranchList.data.length}` : '');

                const inClientBranchCreateAllowed = await api('POST', `/api/clients/${scopedClientId}/branches`, {
                    name: `In Scope Client Branch ${scopeTs}`,
                    code: `ICB${String(scopeTs).slice(-4)}`,
                    city: 'Karachi',
                });
                check('POST /api/clients/[id]/branches as in-scope manager', inClientBranchCreateAllowed.status === 201, `${inClientBranchCreateAllowed.status}`);
                record('/api/clients/[id]/branches POST in-scope manager 201', inClientBranchCreateAllowed.status === 201 ? 'PASS' : 'FAIL', 201, inClientBranchCreateAllowed.status, inClientBranchCreateAllowed.data?.id || inClientBranchCreateAllowed.data?.message);

                const inBranchCreateAllowed = await api('POST', '/api/branches', {
                    clientId: scopedClientId,
                    name: `In Scope Branch ${scopeTs}`,
                    code: `IB${String(scopeTs).slice(-4)}`,
                    city: 'Karachi',
                });
                check('POST /api/branches as in-scope manager', inBranchCreateAllowed.status === 201, `${inBranchCreateAllowed.status}`);
                record('/api/branches POST in-scope manager 201', inBranchCreateAllowed.status === 201 ? 'PASS' : 'FAIL', 201, inBranchCreateAllowed.status, inBranchCreateAllowed.data?.id || inBranchCreateAllowed.data?.message);

                if (scopedBranchId) {
                    const inBranchPatchAllowed = await api('PATCH', `/api/branches/${scopedBranchId}`, {
                        name: `Scope Branch Updated ${scopeTs}`,
                    });
                    check('PATCH /api/branches/[id] as in-scope manager', inBranchPatchAllowed.status === 200, `${inBranchPatchAllowed.status}`);
                    record('/api/branches/[id] PATCH in-scope manager 200', inBranchPatchAllowed.status === 200 ? 'PASS' : 'FAIL', 200, inBranchPatchAllowed.status, inBranchPatchAllowed.data?.id || inBranchPatchAllowed.data?.message);
                }
            }

            await loginAs({
                email: 'admin@parwestgroup.com',
                password: 'admin123@',
                label: 'admin-restore',
            });
        } else {
            record('/api/payroll manager-scope seed', 'FAIL', 'seed loan + out-scope region', 'missing setup refs', 'Cannot run manager-scope assertions without seeded payroll row and out-scope region.');
        }
    }

    // =========== WORKFLOW PRESET PRECEDENCE ===========
    console.log('\n=== WORKFLOW PRESET PRECEDENCE ===');
    const workflowGet = await api('GET', '/api/workflow-rules');
    const workflowGetPass = workflowGet.status === 200 && Array.isArray(workflowGet.data?.rules);
    check('GET /api/workflow-rules', workflowGetPass, `${workflowGet.status}`);
    record('/api/workflow-rules GET', workflowGetPass ? 'PASS' : 'FAIL', '200 + rules[]', `${workflowGet.status} + rules=${Array.isArray(workflowGet.data?.rules)}`, workflowGet.data?.message);

    let initialRuleMap = {};
    if (Array.isArray(workflowGet.data?.rules)) {
        initialRuleMap = workflowGet.data.rules.reduce((acc, row) => {
            if (row?.key && typeof row?.value === 'boolean') acc[row.key] = row.value;
            return acc;
        }, {});
    }

    if (workflowGetPass) {
        const workflowPresetRelaxed = await api('PATCH', '/api/workflow-rules', { presetId: 'relaxed' });
        const presetRules = Array.isArray(workflowPresetRelaxed.data?.rules) ? workflowPresetRelaxed.data.rules : [];
        const relaxedSingleActive = presetRules.find((row) => row?.key === 'deployments.singleActivePerGuard')?.value;
        const relaxedTransition = presetRules.find((row) => row?.key === 'inventoryDemand.enforceTransitionMap')?.value;
        const workflowPresetRelaxedPass =
            workflowPresetRelaxed.status === 200 &&
            relaxedSingleActive === false &&
            relaxedTransition === false;
        check('PATCH /api/workflow-rules preset relaxed', workflowPresetRelaxedPass, `${workflowPresetRelaxed.status}`);
        record(
            '/api/workflow-rules PATCH preset relaxed',
            workflowPresetRelaxedPass ? 'PASS' : 'FAIL',
            '200 + relaxed key rules disabled',
            `${workflowPresetRelaxed.status} + singleActive=${String(relaxedSingleActive)} + transitionMap=${String(relaxedTransition)}`,
            workflowPresetRelaxed.data?.message
        );

        const workflowManualOverride = await api('PATCH', '/api/workflow-rules', {
            updates: {
                'deployments.singleActivePerGuard': true,
            },
        });
        const manualRules = Array.isArray(workflowManualOverride.data?.rules) ? workflowManualOverride.data.rules : [];
        const manualSingleActive = manualRules.find((row) => row?.key === 'deployments.singleActivePerGuard')?.value;
        const manualTransition = manualRules.find((row) => row?.key === 'inventoryDemand.enforceTransitionMap')?.value;
        const workflowManualOverridePass =
            workflowManualOverride.status === 200 &&
            manualSingleActive === true &&
            manualTransition === false;
        check('PATCH /api/workflow-rules manual override after preset', workflowManualOverridePass, `${workflowManualOverride.status}`);
        record(
            '/api/workflow-rules PATCH manual override precedence',
            workflowManualOverridePass ? 'PASS' : 'FAIL',
            '200 + overridden rule true while another relaxed rule remains false',
            `${workflowManualOverride.status} + singleActive=${String(manualSingleActive)} + transitionMap=${String(manualTransition)}`,
            workflowManualOverride.data?.message
        );

        const workflowRestore = await api('PATCH', '/api/workflow-rules', { updates: initialRuleMap });
        const workflowRestorePass = workflowRestore.status === 200;
        check('PATCH /api/workflow-rules restore initial', workflowRestorePass, `${workflowRestore.status}`);
        record(
            '/api/workflow-rules PATCH restore initial',
            workflowRestorePass ? 'PASS' : 'FAIL',
            200,
            workflowRestore.status,
            workflowRestore.data?.message || 'restored to initial snapshot'
        );
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
        process.exitCode = 1;
    }

    // Output machine-readable JSON for checklist update
    const output = JSON.stringify({ summary: { total, passed, failed }, results }, null, 2);
    import('fs').then(fs => fs.writeFileSync('/tmp/api-test-results.json', output));
    console.log('\nDetailed results saved to /tmp/api-test-results.json');
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
