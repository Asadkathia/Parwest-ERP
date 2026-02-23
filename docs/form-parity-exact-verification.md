# Exact Form Field Verification (Legacy vs Current)

- Screens checked: **21**
- Average field match: **27.6%**
- Average dropdown option match: **21.5%**

## Per-Screen Results
### Add Guard
- Legacy: `/guard/create`
- Current: `/guards/new`
- Field match: **55.7%** (34/61)
- Dropdown option match: **32.4%** (11/34)
- Missing fields (sample): 3, 68, 71, 88, 107, 108, 110, 111, parwest_shortname, FATHER'S NAME *, MOTHER'S NAME *, ex, other, DD-MM-YYYY, Year, Name Of Institute, Introducer's CNIC, Introducer's Address, Introducer's Contact, Height *, Weight *, Eye Color *, Hair Color *, Any Disability *, Mark of Identification*
- Missing dropdown options (sample): head office lahore, Guard, location supervisor, cpo, SO, ASO, LSO, Receptionist, CCTV Operator, Complaint Receiver, --Select Blood Group--, O+ve, A+ve, B+ve, AB+ve, --Select Marital Status--, separated, engaged, Choose Education Level, B.A, BSc, M.A, Msc

### Search Guard
- Legacy: `/guard/search`
- Current: `/guards/search`
- Field match: **68%** (17/25)
- Dropdown option match: **1.5%** (5/325)
- Missing fields (sample): client_id, supervisor_id, isOverstaying, isOnNightDuty, isArchived, Show 102550100200500All records, Search:, Select Date
- Missing dropdown options (sample): --Select Education--, Intermediate, Matric, Middle, Graduate, B.A, BSc, M.A, Msc, --Select Relegion--, Islam, Christianity, Hinduism, --Select Status--, present, absent, on-training, default, resigned, Long Leave, --Select Client--, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd

### Export Guard
- Legacy: `/searchByDataTable`
- Current: `/guards/export`
- Field match: **0%** (0/9)
- Dropdown option match: **0%** (0/116)
- Missing fields (sample): Parwest ID, Name, CNIC#, current_status_id, ex_service_id, supervisor_id, verification_status_id, Search:, Select Date
- Missing dropdown options (sample): --Select Status--, present, absent, on-training, default, resigned, Inactive, Long Leave, Pending, --Select Ex Service--, other, mujahid, rangers, police, army, --Select Supervisor--, ABDUL FATEH Khi Zone I, ahtisham, Akhtar Mehmood FSD, Akhter Ali, ALI MADAD KHI Z III, ALLAH YAR KHI Z III, Altaf Hussain LHR, Arshad Mehmood ICT, AYUB HUSSAIN KHI Z II

### Prerequisites
- Legacy: `/guard/mergedOptions`
- Current: `/guards/prerequisites`
- Field match: **0%** (0/1)
- Dropdown option match: **100%** (0/0)
- Missing fields (sample): Add CWFE deduction

### Black Listed Guards
- Legacy: `/guard/blackListedGuards`
- Current: `/guards/blacklist`
- Field match: **0%** (0/3)
- Dropdown option match: **0%** (0/4)
- Missing fields (sample): rowCountSelect, Search by CNIC number..., Cnic #
- Missing dropdown options (sample): 10 rows, 25 rows, 50 rows, 100 rows

### Inactive Guards
- Legacy: `/guard/softDeletedGuardList`
- Current: `/guards/inactive`
- Field match: **0%** (0/3)
- Dropdown option match: **0%** (0/5)
- Missing fields (sample): Show 102550100200 entries, Search:, Select Date
- Missing dropdown options (sample): 10, 25, 50, 100, 200

### Deploy Guards
- Legacy: `/guard/GuardDeployment`
- Current: `/guards/deploy`
- Field match: **42.3%** (11/26)
- Dropdown option match: **1.5%** (3/201)
- Missing fields (sample): region_id_on_user_profile, client_id_on_user_profile, branch_id_on_user_profile, Select Guard, Guard's Name, Guard's Designations, Guard's Type, Guard Deployment Status*, shift, isExtra, Supervisor Name, Manager Name, Add Comment, check, Select Action:
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited

### Deployment Rate
- Legacy: `/guard/GuardDeploymentRate`
- Current: `/guards/deployments-rate`
- Field match: **50%** (5/10)
- Dropdown option match: **2%** (4/199)
- Missing fields (sample): region_id_on_user_profile, client_id_on_user_profile, branch_id_on_user_profile, deployGuardAsDesignation[], exService
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited

### Guard Attendance
- Legacy: `/guard/attendance`
- Current: `/guards/attendance`
- Field match: **33.3%** (1/3)
- Dropdown option match: **100%** (0/0)
- Missing fields (sample): Secure Ops ID, Strat Date*

### Client Attendance
- Legacy: `/guard/clientAttendance`
- Current: `/guards/client-attendance`
- Field match: **40%** (2/5)
- Dropdown option match: **11.1%** (2/18)
- Missing fields (sample): edit_regional_office, selected_client, client_branches
- Missing dropdown options (sample): head office lahore, islamabad, quetta, peshawar, karachi, multan, sahiwal, gujranwala, faisalabad, sub office kasur, sub office sheikhupura, test office, hyderabad, sukkur, qadir pur ghotki, jand

### Residences
- Legacy: `/guard/residences`
- Current: `/guards/residences`
- Field match: **66.7%** (4/6)
- Dropdown option match: **0%** (0/69)
- Missing fields (sample): Show 102550100 entries, Select Supervisor
- Missing dropdown options (sample): 10, 25, 50, 100, ahtisham, Akhtar Mehmood FSD, ALI MADAD KHI Z III, ALLAH YAR KHI Z III, Altaf Hussain LHR, Arshad Mehmood ICT, AYUB HUSSAIN KHI Z II, AZHAR ALI KHI Z II, Bilal Ahmad, FAREED Ahmad fsld, Fazal Ahmad, Fazal Mehdi, grw M Arshad, Hafeezullah gwa, Haider Ali, Ijaz Ahmad MT, IKHLAQ HUSSAIN KHI IS Z II, Imtiaz Hussain, Irshad Ullah, Ishaq Ahmed, Javeed Akhter

### Assign Residence
- Legacy: `/guard/residences/assign`
- Current: `/guards/assign-residence`
- Field match: **22.2%** (2/9)
- Dropdown option match: **0%** (0/66)
- Missing fields (sample): supervisor_id_on_user_profile, residence_id, Guard's Name, Guard's Designations, Guard's Type, Revoke Date, comment
- Missing dropdown options (sample): --Select Supervisor--, ahtisham, Akhtar Mehmood FSD, ALI MADAD KHI Z III, ALLAH YAR KHI Z III, Altaf Hussain LHR, Arshad Mehmood ICT, AYUB HUSSAIN KHI Z II, AZHAR ALI KHI Z II, Bilal Ahmad, FAREED Ahmad fsld, Fazal Ahmad, Fazal Mehdi, grw M Arshad, Hafeezullah gwa, Haider Ali, Ijaz Ahmad MT, IKHLAQ HUSSAIN KHI IS Z II, Imtiaz Hussain, Irshad Ullah, Ishaq Ahmed, Javeed Akhter, KHALID MEHMOOD, MANSOOR AHMED KHI Z III, MANTHAR ALI KHI IS Z I

### Onjob Trainings
- Legacy: `/guard/onjob-trainings`
- Current: `/guards/trainings`
- Field match: **20%** (2/10)
- Dropdown option match: **0%** (0/174)
- Missing fields (sample): regional_office_id, client_id, branch_id, Search by client, branch, guard, supervisor..., Items per page:, Armorer, Yes, No
- Missing dropdown options (sample): --Select Regional Office--, head office lahore, --Select Client--, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited, Habib Bank Limited, Crystalline Chemicals Industries Pvt Ltd, Parsi Grave Yard, FGA of Pakistan, Ghalib Assocoates, Saudi Pak BA Rajpot, AM Gill Pvt Ltd, Trans Fab, Mr Atif Murad, 21 5 Cantt Lahore Qalnadr, 239 FF DHA, Mr Basit Rehman Malik, HOUSE#96 U, PHASE III, DHA

### Add Client
- Legacy: `/client/create`
- Current: `/clients/new`
- Field match: **81.8%** (27/33)
- Dropdown option match: **3%** (10/332)
- Missing fields (sample): is_client_branch_less_checkbox, Client's Name *, Client's Email *, Client's Postal Code, operationalProvinces[], default_branch_name
- Missing dropdown options (sample): Lahore, Gujranwala, Sahiwal, Multan, Karachi, Faisalabad, Khanpur, Chichawatni, Bahawalpur, Mian Channu, Khanewal, Ahmedpur East, Ahmed Nager Chatha, Ali Pur, Arifwala, Attock, Basti Malook, Bhagalchur, Bhalwal, Bahawalnagar, Bhaipheru, Bhakkar, Burewala, Chailianwala, Chakwal

### Search Client
- Legacy: `/client/searchResult`
- Current: `/clients/search`
- Field match: **0%** (0/6)
- Dropdown option match: **0%** (0/312)
- Missing fields (sample): Name, Select Client Type, Select City, Show 102550100200 entries, Search:, Select Date
- Missing dropdown options (sample): --Select Client Type--, bank, manufacturer, other, --Select City--, All Cities, Lahore, Gujranwala, Sahiwal, Multan, Karachi, Faisalabad, Khanpur, Chichawatni, Bahawalpur, Mian Channu, Khanewal, Ahmedpur East, Ahmed Nager Chatha, Ali Pur, Arifwala, Attock, Basti Malook, Bhagalchur, Bhalwal

### Search Client V2
- Legacy: `/client/v2/search`
- Current: `/clients/search-v2`
- Field match: **0%** (0/6)
- Dropdown option match: **0%** (0/311)
- Missing fields (sample): Name, Select Client Type, Select City, Show 102550100 entries per page, Search:, Select Date
- Missing dropdown options (sample): --Select Client Type--, bank, manufacturer, other, --Select City--, All Cities, Lahore, Gujranwala, Sahiwal, Multan, Karachi, Faisalabad, Khanpur, Chichawatni, Bahawalpur, Mian Channu, Khanewal, Ahmedpur East, Ahmed Nager Chatha, Ali Pur, Arifwala, Attock, Basti Malook, Bhagalchur, Bhalwal

### Types & Locations
- Legacy: `/client/typeList`
- Current: `/clients/types-locations`
- Field match: **100%** (0/0)
- Dropdown option match: **100%** (0/0)

### Black Listed Clients
- Legacy: `/client/blackListedClients`
- Current: `/clients/blacklist`
- Field match: **0%** (0/1)
- Dropdown option match: **100%** (0/0)
- Missing fields (sample): Email

### Export Client Branches
- Legacy: `/client/exportClientBranches`
- Current: `/clients/export-branches`
- Field match: **0%** (0/74)
- Dropdown option match: **0%** (0/93)
- Missing fields (sample): Select Manager, Select Client, select_all_checkbox, check_box_1, check_box_2, check_box_3, check_box_4, check_box_5, check_box_6, check_box_7, check_box_8, check_box_9, check_box_10, check_box_15, check_box_16, check_box_19, check_box_22, check_box_25, check_box_26, check_box_27, check_box_28, check_box_29, check_box_30, check_box_31, check_box_32
- Missing dropdown options (sample): --Select Manager--, Anayat Ullah MT, Ashfaq Ali, Capt M Baqar FSD, GHULAM BAQIR KHAN Zone II III, Ghulam Qadir MT, Haji Umar Daraz Sahiwal, hashir, JAHANGIR KHAN KHI Z II, Muhammad Afzal Abid, Muhammad Arshad, Muhammad Farhan Abbas, Muhammad Nazir, Muhammad Shabbir, Muhammad Tayyab, Qaisar Mehmood Kiani, Riaz Ahmad, SAJJAD HUSSAIN KHI Z I, usman, Waqar Ahmad, Waqas Nasir Mehmood, ZULFIQAR AHMED KHI Z III, --Select Client--, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan

### Invoice Prerequisites
- Legacy: `/client/invoicePrerequisites`
- Current: `/clients/invoice-prerequisites`
- Field match: **0%** (0/17)
- Dropdown option match: **0%** (0/26)
- Missing fields (sample): Select Province, Select City, Select Guard Type, Show 102550100200 entries, Search:, Client Province, Client Cities, Guard Types, Effective Rate, Edit Rate, Name, Province, ID, Province Name, City Name, Guard Type, Guard Type Name
- Missing dropdown options (sample): --Select Province--, All Pakistan, Punjab, Sindh, Balochistan, KPK, ICT Islamabad, Gilgit Baltistan, AJK Kashmir, --Select City--, --Guard Type--, Guard, location supervisor, cpo, SO, ASO, LSO, Receptionist, CCTV Operator, Complaint Receiver, 10, 25, 50, 100, 200

### Invoiced Billings
- Legacy: `/client/invoicedBillings`
- Current: `/clients/invoiced-billings`
- Field match: **0%** (0/23)
- Dropdown option match: **0%** (0/307)
- Missing fields (sample): selected_client, client_branches, Select Invoice Month, Select Invoices From, Select Invoices To, Invoice Due Date, invoice_status, selectAllToPost, postCheck_6366, postCheck_6365, postCheck_6364, postCheck_6363, postCheck_6362, postCheck_6361, postCheck_6360, postCheck_6359, postCheck_6358, postCheck_6357, error_selected_client, error_client_branches, Show 102550100200 entries, Search:, Add Payment
- Missing dropdown options (sample): --Select Client--, National Bank of Pakistan, Standard Chartered Bank Limited Pakistan, United Bank Limited, MCB Bank Ltd, Faysal Bank Limited, Summit Bank Limited, Meezan Bank Limited, Bank Al Habib Limited, Samba Bank Limited, Habib Bank Limited, Verscom Technologies, Lahore Safe Deposit, Lahore Childeren Center, Church of Jesus, Crystalline Chemicals Industries Pvt Ltd, Mr Fazale Rabi, Wisal Kamal Fabrics pvt Ltd, Punjab Civil Officer Mess GOR, Parsi Grave Yard, 195 Cavalry (Ahmad Ameen), Hamza Carpets, FGA of Pakistan, Ghalib Assocoates, Saudi Pak BA Rajpot

## Strict Verdict
- Exact same fields/options are **not yet achieved** across screens.
- Use this report to implement one screen at a time until each reaches 100% field + option match.
