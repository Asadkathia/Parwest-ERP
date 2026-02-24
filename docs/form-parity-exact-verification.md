# Exact Form Field Verification (Legacy vs Current)

- Screens checked: **21**
- Average field match: **90.5%**
- Average dropdown option match: **28.9%**

## Per-Screen Results
### Add Guard
- Legacy: `/guard/create`
- Current: `/guards/new`
- Field match: **100%** (61/61)
- Dropdown option match: **100%** (34/34)

### Search Guard
- Legacy: `/guard/search`
- Current: `/guards/search`
- Field match: **100%** (25/25)
- Dropdown option match: **10.2%** (33/325)
- Missing dropdown options (sample): United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited, Habib Bank Limited, Crystalline Chemicals Industries Pvt Ltd, Parsi Grave Yard, FGA of Pakistan, Ghalib Assocoates, Saudi Pak BA Rajpot, AM Gill Pvt Ltd, Trans Fab, Mr Atif Murad, 21 5 Cantt Lahore Qalnadr, 239 FF DHA, Mr Basit Rehman Malik, HOUSE#96 U, PHASE III, DHA, UDL, Associate House, KKT Hospital, KKT HOSPITAL JOHAR TOWN, Allied Bank Limited

### Export Guard
- Legacy: `/searchByDataTable`
- Current: `/guards/export`
- Field match: **100%** (9/9)
- Dropdown option match: **21.6%** (25/116)
- Missing dropdown options (sample): AZHAR ALI KHI Z II, Baiq Khan, Bilal Ahmad, EHSAAN AHMED Khi Zone I, FAREED Ahmad fsld, Fateh Ali Lillah, Fazal Ahmad, Fazal Mehdi, Ghulam Ahmad Rabbani, grw M Arshad, Hafeezullah gwa, Hafiz Ullah MT, Haider Ali, Ijaz Ahmad MT, IKHLAQ HUSSAIN KHI IS Z II, IMDAD ALI Khi Zone III, Imtiaz Hussain, IRFAN MEHMOOD Khi Zone III, Irshad Ullah, Ishaq Ahmed, Jameel Altaf FSD, Javeed Akhter, KHALID MEHMOOD, LUTAF ALI Khi Zone II, MANSOOR AHMED KHI Z III

### Prerequisites
- Legacy: `/guard/mergedOptions`
- Current: `/guards/prerequisites`
- Field match: **100%** (1/1)
- Dropdown option match: **100%** (0/0)

### Black Listed Guards
- Legacy: `/guard/blackListedGuards`
- Current: `/guards/blacklist`
- Field match: **100%** (3/3)
- Dropdown option match: **0%** (0/4)
- Missing dropdown options (sample): 10 rows, 25 rows, 50 rows, 100 rows

### Inactive Guards
- Legacy: `/guard/softDeletedGuardList`
- Current: `/guards/inactive`
- Field match: **100%** (3/3)
- Dropdown option match: **0%** (0/5)
- Missing dropdown options (sample): 10, 25, 50, 100, 200

### Deploy Guards
- Legacy: `/guard/GuardDeployment`
- Current: `/guards/deploy`
- Field match: **100%** (26/26)
- Dropdown option match: **6.5%** (13/201)
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited

### Deployment Rate
- Legacy: `/guard/GuardDeploymentRate`
- Current: `/guards/deployments-rate`
- Field match: **100%** (10/10)
- Dropdown option match: **8%** (16/199)
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited

### Guard Attendance
- Legacy: `/guard/attendance`
- Current: `/guards/attendance`
- Field match: **100%** (3/3)
- Dropdown option match: **100%** (0/0)

### Client Attendance
- Legacy: `/guard/clientAttendance`
- Current: `/guards/client-attendance`
- Field match: **100%** (5/5)
- Dropdown option match: **11.1%** (2/18)
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand

### Residences
- Legacy: `/guard/residences`
- Current: `/guards/residences`
- Field match: **100%** (6/6)
- Dropdown option match: **0%** (0/69)
- Missing dropdown options (sample): 10, 25, 50, 100, ahtisham, Akhtar Mehmood FSD, ALI MADAD KHI Z III, ALLAH YAR KHI Z III, Altaf Hussain LHR, Arshad Mehmood ICT, AYUB HUSSAIN KHI Z II, AZHAR ALI KHI Z II, Bilal Ahmad, FAREED Ahmad fsld, Fazal Ahmad, Fazal Mehdi, grw M Arshad, Hafeezullah gwa, Haider Ali, Ijaz Ahmad MT, IKHLAQ HUSSAIN KHI IS Z II, Imtiaz Hussain, Irshad Ullah, Ishaq Ahmed, Javeed Akhter

### Assign Residence
- Legacy: `/guard/residences/assign`
- Current: `/guards/assign-residence`
- Field match: **100%** (9/9)
- Dropdown option match: **0%** (0/66)
- Missing dropdown options (sample): --Select Supervisor--, ahtisham, Akhtar Mehmood FSD, ALI MADAD KHI Z III, ALLAH YAR KHI Z III, Altaf Hussain LHR, Arshad Mehmood ICT, AYUB HUSSAIN KHI Z II, AZHAR ALI KHI Z II, Bilal Ahmad, FAREED Ahmad fsld, Fazal Ahmad, Fazal Mehdi, grw M Arshad, Hafeezullah gwa, Haider Ali, Ijaz Ahmad MT, IKHLAQ HUSSAIN KHI IS Z II, Imtiaz Hussain, Irshad Ullah, Ishaq Ahmed, Javeed Akhter, KHALID MEHMOOD, MANSOOR AHMED KHI Z III, MANTHAR ALI KHI IS Z I

### Onjob Trainings
- Legacy: `/guard/onjob-trainings`
- Current: `/guards/trainings`
- Field match: **100%** (10/10)
- Dropdown option match: **4%** (7/174)
- Missing dropdown options (sample): head office lahore, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited, Habib Bank Limited, Crystalline Chemicals Industries Pvt Ltd, Parsi Grave Yard, FGA of Pakistan, Ghalib Assocoates, Saudi Pak BA Rajpot, AM Gill Pvt Ltd, Trans Fab, Mr Atif Murad, 21 5 Cantt Lahore Qalnadr, 239 FF DHA, Mr Basit Rehman Malik, HOUSE#96 U, PHASE III, DHA, UDL, Associate House

### Add Client
- Legacy: `/client/create`
- Current: `/clients/new`
- Field match: **100%** (33/33)
- Dropdown option match: **12%** (40/332)
- Missing dropdown options (sample): Darya Khan, Dera Ghazi Khan, Derawar Fort, Dhaular, Dina City, Dinga, Dipalpur, Fateh Jang, Gadar, Ghakhar Mandi, Gujrat, Gujar Khan, Hafizabad, Haroonabad, Hasilpur, Haveli Lakha, Jampur, Jhang, Jhelum, Kalabagh, Karor Lal Esan, Kasur, Kamalia, Kamokey, Kharian

### Search Client
- Legacy: `/client/searchResult`
- Current: `/clients/search`
- Field match: **100%** (6/6)
- Dropdown option match: **11.2%** (35/312)
- Missing dropdown options (sample): Darya Khan, Dera Ghazi Khan, Derawar Fort, Dhaular, Dina City, Dinga, Dipalpur, Fateh Jang, Gadar, Ghakhar Mandi, Gujrat, Gujar Khan, Hafizabad, Haroonabad, Hasilpur, Haveli Lakha, Jampur, Jhang, Jhelum, Kalabagh, Karor Lal Esan, Kasur, Kamalia, Kamokey, Kharian

### Search Client V2
- Legacy: `/client/v2/search`
- Current: `/clients/search-v2`
- Field match: **100%** (6/6)
- Dropdown option match: **11.3%** (35/311)
- Missing dropdown options (sample): Darya Khan, Dera Ghazi Khan, Derawar Fort, Dhaular, Dina City, Dinga, Dipalpur, Fateh Jang, Gadar, Ghakhar Mandi, Gujrat, Gujar Khan, Hafizabad, Haroonabad, Hasilpur, Haveli Lakha, Jampur, Jhang, Jhelum, Kalabagh, Karor Lal Esan, Kasur, Kamalia, Kamokey, Kharian

### Types & Locations
- Legacy: `/client/typeList`
- Current: `/clients/types-locations`
- Field match: **100%** (0/0)
- Dropdown option match: **100%** (0/0)

### Black Listed Clients
- Legacy: `/client/blackListedClients`
- Current: `/clients/blacklist`
- Field match: **100%** (1/1)
- Dropdown option match: **100%** (0/0)

### Export Client Branches
- Legacy: `/client/exportClientBranches`
- Current: `/clients/export-branches`
- Field match: **0%** (0/0)
- Dropdown option match: **0%** (0/0)
- Error: Error: page.goto: net::ERR_NETWORK_IO_SUSPENDED at https://staging-erp.parwestgroup.com/client/exportClientBranches
Call log:
[2m  - navigating to "https://staging-erp.parwestgroup.com/client/exportClientBranches", waiting until "domcontentloaded"[22m


### Invoice Prerequisites
- Legacy: `/client/invoicePrerequisites`
- Current: `/clients/invoice-prerequisites`
- Field match: **100%** (17/17)
- Dropdown option match: **11.5%** (3/26)
- Missing dropdown options (sample): All Pakistan, Punjab, Sindh, Balochistan, KPK, ICT Islamabad, Gilgit Baltistan, AJK Kashmir, Guard, location supervisor, cpo, SO, ASO, LSO, Receptionist, CCTV Operator, Complaint Receiver, 10, 25, 50, 100, 200, ---Select Guard Type---

### Invoiced Billings
- Legacy: `/client/invoicedBillings`
- Current: `/clients/invoiced-billings`
- Field match: **0%** (0/0)
- Dropdown option match: **0%** (0/0)
- Error: TimeoutError: page.goto: Timeout 60000ms exceeded.
Call log:
[2m  - navigating to "https://staging-erp.parwestgroup.com/client/invoicedBillings", waiting until "domcontentloaded"[22m


## Strict Verdict
- Exact same fields/options are **not yet achieved** across screens.
- Use this report to implement one screen at a time until each reaches 100% field + option match.
