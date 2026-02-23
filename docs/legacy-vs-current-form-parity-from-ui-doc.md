# Form Parity (Using UI Fields Doc vs Current Code)

- Legacy form entries parsed: **25**
- Entries with mapped current route: **22**
- Entries with legacy fields: **19**
- Average match: **51.2%**

## Entries Not Fully Matched
- Export Guards to Excel: /searchByDataTable -> /guards/export : 0% (0/9)
  missing sample: Parwest ID, Name, CNIC#, Select Status, Ex Service, Supervisor, Verification Status, Search:, Select Date
- Search Client Screen: /client/searchResult -> /clients/search : 0% (0/6)
  missing sample: Name, Select Client Type, Select City, Show 102550100200 entries, Search:, Select Date
- Search Client Screen V2: /client/v2/search -> /clients/search-v2 : 0% (0/6)
  missing sample: Name, Select Client Type, Select City, Show 102550100 entries per page, Search:, Select Date
- Black Listed Clients: /client/blackListedClients -> /clients/blacklist : 0% (0/1)
  missing sample: Email
- Export Clients/Branches: /client/exportClientBranches -> /clients/export-branches : 0% (0/2)
  missing sample: Select Manager, Select Client
- Client Invoice Pre-requisites: /client/invoicePrerequisites -> /clients/invoice-prerequisites : 0% (0/15)
  missing sample: Select Province, Select City, Select Guard Type, Show 102550100200 entries, Search:, Client Province, Client Cities, Guard Types, Effective Rate, Enqueue
- Invoiced Billing Screen of Clients: /client/invoicedBillings -> /clients/invoiced-billings : 0% (0/10)
  missing sample: Select Client, Select Branch, Select Invoice Month, Select Invoices From, Select Invoices To, Invoice Due Date, Select Invoice Status, Show 102550100200 entries, Search:, Add Payment
- Add Guard Screen (FORMS): /guard/create -> /guards/new : 5% (1/20)
  missing sample: Select All, NADRA Verification, Health Certificate Verification, Police Verification, Eyesight Certificate, character verification, mental health check, 3rd gurantor verysis, Company card & CNIC, Parwest ID*
- Deployment Rates Setting: /guard/GuardDeploymentRate -> /guards/deployments-rate : 69.2% (9/13)
  missing sample: Guard's Type, Day, Night, Both

## Missing Route Mappings
- Guard Profile Screen (from Search Guard): /guard/show/31367
- Client Profile Screen: /client/show/327
- Client Profile Screen V2: /client/v2/show/327
