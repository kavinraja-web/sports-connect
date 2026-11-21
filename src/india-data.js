/**
 * India States and Districts Dataset for ProSports Mobile App
 */
const INDIA_STATES_AND_DISTRICTS = {
    "Tamil Nadu": [
        "Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli", 
        "Erode", "Vellore", "Dindigul", "Thanjavur", "Kanchipuram", "Tiruppur", 
        "Cuddalore", "Karur", "Nagapattinam", "Namakkal", "Nilgiris", "Pudukkottai", 
        "Ramanathapuram", "Sivaganga", "Tenkasi", "Theni", "Thoothukudi", "Tirupathur", 
        "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Ranipet", "Villupuram", 
        "Virudhunagar", "Kallakurichi", "Chengalpattu", "Dharmapuri", "Krishnagiri", 
        "Mayiladuthurai", "Kanyakumari", "Ariyalur", "Perambalur"
    ],
    "Maharashtra": [
        "Mumbai City", "Mumbai Suburban", "Pune", "Nagpur", "Nashik", "Thane", 
        "Chhatrapati Sambhaji Nagar (Aurangabad)", "Solapur", "Kolhapur", "Amravati", 
        "Nanded", "Jalgaon", "Akola", "Latur", "Dhule", "Ahmednagar", "Chandrapur", 
        "Parbhani", "Jalna", "Beed", "Raigad", "Satara", "Sangli", "Wardha", 
        "Yavatmal", "Bhandara", "Gondia", "Gadchiroli", "Buldhana", "Washim", 
        "Hingoli", "Dharashiv (Osmanabad)", "Nandurbar", "Ratnagiri", "Sindhudurg", "Palghar"
    ],
    "Karnataka": [
        "Bengaluru Urban", "Bengaluru Rural", "Mysuru", "Hubballi-Dharwad", "Dakshina Kannada (Mangaluru)", 
        "Belagavi", "Kalaburagi", "Ballari", "Davanagere", "Shivamogga", "Tumakuru", 
        "Bidar", "Raichur", "Vijayapura", "Hassan", "Mandya", "Udupi", "Chikkamagaluru", 
        "Chitradurga", "Kolar", "Chikkaballapur", "Ramanagara", "Bagalkote", "Gadag", 
        "Haveri", "Uttara Kannada", "Kodagu", "Koppal", "Yadgir", "Chamarajanagar", "Vijayanagara"
    ],
    "Kerala": [
        "Thiruvananthapuram", "Ernakulam", "Kozhikode", "Thrissur", "Kollam", 
        "Palakkad", "Malappuram", "Kannur", "Alappuzha", "Kottayam", "Kasaragod", 
        "Pathanamthitta", "Idukki", "Wayanad"
    ],
    "Delhi": [
        "Central Delhi", "East Delhi", "New Delhi", "North Delhi", "North East Delhi", 
        "North West Delhi", "Shahdara", "South Delhi", "South East Delhi", "South West Delhi", "West Delhi"
    ],
    "Telangana": [
        "Hyderabad", "Warangal", "Karimnagar", "Nizamabad", "Khammam", "Nalgonda", 
        "Rangareddy", "Medchal-Malkajgiri", "Sangareddy", "Siddipet", "Mahabubnagar", 
        "Suryapet", "Adilabad", "Mancherial", "Nirmal", "Jagtial", "Peddapalli", 
        "Bhadradri Kothagudem", "Mahabubabad", "Jangaon", "Jayashankar Bhupalpally", 
        "Mulugu", "Wanaparthy", "Nagarkurnool", "Jogulamba Gadwal", "Narayanpet", 
        "Vikarabad", "Medak", "Kamareddy", "Rajanna Sircilla", "Kumuram Bheem Asifabad"
    ],
    "Andhra Pradesh": [
        "Visakhapatnam", "NTR (Vijayawada)", "Guntur", "Tirupati", "Kurnool", 
        "SPSR Nellore", "Kakinada", "East Godavari (Rajamahendravaram)", "YSR Kadapa", 
        "Anantapur", "Chittoor", "Srikakulam", "Vizianagaram", "Eluru", "West Godavari", 
        "Krishna (Machilipatnam)", "Prakasam (Ongole)", "Nandyal", "Sri Sathya Sai", 
        "Annamayya", "Bapatla", "Palnadu", "Dr. B.R. Ambedkar Konaseema", 
        "Parvathipuram Manyam", "Alluri Sitharama Raju"
    ],
    "Gujarat": [
        "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", 
        "Junagadh", "Gandhinagar", "Anand", "Bharuch", "Kutch", "Mehsana", 
        "Navsari", "Valsad", "Amreli", "Banaskantha", "Dahod", "Kheda", 
        "Patan", "Porbandar", "Sabarkantha", "Surendranagar", "Morbi", "Gir Somnath"
    ],
    "Rajasthan": [
        "Jaipur", "Jodhpur", "Udaipur", "Kota", "Bikaner", "Ajmer", "Bhilwara", 
        "Alwar", "Sikar", "Bharatpur", "Pali", "Sri Ganganagar", "Chittorgarh", 
        "Barmer", "Jhunjhunu", "Nagaur", "Tonk", "Banswara", "Hanumangarh"
    ],
    "Uttar Pradesh": [
        "Lucknow", "Kanpur Nagar", "Varanasi", "Agra", "Prayagraj (Allahabad)", 
        "Meerut", "Ghaziabad", "Gautam Buddha Nagar (Noida)", "Bareilly", "Aligarh", 
        "Moradabad", "Gorakhpur", "Ayodhya", "Jhansi", "Mathura", "Firozabad", 
        "Muzaffarnagar", "Saharanpur", "Mirzapur", "Budaun", "Rampur", "Shahjahanpur"
    ],
    "Punjab": [
        "Amritsar", "Ludhiana", "Jalandhar", "Patiala", "Bathinda", "SAS Nagar (Mohali)", 
        "Hoshiarpur", "Pathankot", "Moga", "Firozpur", "Gurdaspur", "Kapurthala", 
        "Sangrur", "Barnala", "Faridkot", "Fazilka", "Fatehgarh Sahib", "Rupnagar", "Muktsar"
    ],
    "Haryana": [
        "Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", 
        "Hisar", "Karnal", "Sonipat", "Panchkula", "Sirsa", "Bhiwani", "Jind", 
        "Kurukshetra", "Kaithal", "Rewari", "Palwal", "Jhajjar", "Fatehabad"
    ],
    "West Bengal": [
        "Kolkata", "Howrah", "North 24 Parganas", "South 24 Parganas", "Hooghly", 
        "Darjeeling", "Jalpaiguri", "Paschim Bardhaman", "Purba Bardhaman", 
        "Nadia", "Murshidabad", "Malda", "Paschim Medinipur", "Purba Medinipur", 
        "Birbhum", "Bankura", "Alipurduar", "Cooch Behar", "Kalimpong"
    ],
    "Madhya Pradesh": [
        "Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Dewas", 
        "Satna", "Ratlam", "Rewa", "Chhindwara", "Shivpuri", "Vidisha", "Morena", "Bhind"
    ],
    "Bihar": [
        "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", 
        "Bihar Sharif", "Arrah", "Begusarai", "Katihar", "Munger", "Chapra", "Samastipur"
    ],
    "Odisha": [
        "Khurda (Bhubaneswar)", "Cuttack", "Sundargarh (Rourkela)", "Ganjam (Berhampur)", 
        "Sambalpur", "Puri", "Balasore", "Bhadrak", "Baripada (Mayurbhanj)", "Angul", "Jajpur"
    ],
    "Assam": [
        "Kamrup Metropolitan (Guwahati)", "Cachar (Silchar)", "Dibrugarh", "Jorhat", 
        "Nagaon", "Tinsukia", "Sonitpur", "Kamrup", "Barpeta", "Dhubri", "Bongaigaon"
    ],
    "Goa": [
        "North Goa", "South Goa"
    ],
    "Himachal Pradesh": [
        "Shimla", "Kangra (Dharamshala)", "Mandi", "Solan", "Kullu", "Sirmaur", "Hamirpur", "Una", "Bilaspur", "Chamba"
    ],
    "Uttarakhand": [
        "Dehradun", "Haridwar", "Nainital", "Udham Singh Nagar", "Paui Garhwal", "Tehri Garhwal", "Almora", "Pithoragarh"
    ],
    "Jammu and Kashmir": [
        "Srinagar", "Jammu", "Anantnag", "Baramulla", "Kathua", "Udhampur", "Pulwama", "Budgam", "Kupwara"
    ],
    "Puducherry": [
        "Puducherry", "Karaikal", "Mahe", "Yanam"
    ],
    "Chandigarh": [
        "Chandigarh"
    ]
};

const PROSPORTS_SUPPORTED_SPORTS = [
    { id: "Cricket", name: "Cricket", icon: "fas fa-baseball-ball", color: "text-amber-500" },
    { id: "Football", name: "Football", icon: "fas fa-futbol", color: "text-red-500" },
    { id: "Volleyball", name: "Volleyball", icon: "fas fa-volleyball-ball", color: "text-blue-500" },
    { id: "Basketball", name: "Basketball", icon: "fas fa-basketball-ball", color: "text-orange-500" },
    { id: "Badminton", name: "Badminton", icon: "fas fa-feather-alt", color: "text-teal-500" },
    { id: "Athletics", name: "Athletics", icon: "fas fa-running", color: "text-emerald-500" },
    { id: "Hockey", name: "Hockey", icon: "fas fa-hockey-puck", color: "text-indigo-500" },
    { id: "Kabaddi", name: "Kabaddi", icon: "fas fa-users", color: "text-yellow-600" },
    { id: "Tennis", name: "Tennis", icon: "fas fa-table-tennis", color: "text-lime-500" },
    { id: "Table Tennis", name: "Table Tennis", icon: "fas fa-table-tennis", color: "text-cyan-500" }
];

const PROSPORTS_AGE_CATEGORIES = [
    { id: "Under 16", label: "Under 16", desc: "Ages 12 - 15" },
    { id: "Under 18", label: "Under 18", desc: "Ages 16 - 17" },
    { id: "Under 21", label: "Under 21", desc: "Ages 18 - 20" },
    { id: "Open / Senior", label: "Open / Senior", desc: "Ages 21+" }
];

if (typeof window !== 'undefined') {
    window.INDIA_STATES_AND_DISTRICTS = INDIA_STATES_AND_DISTRICTS;
    window.PROSPORTS_SUPPORTED_SPORTS = PROSPORTS_SUPPORTED_SPORTS;
    window.PROSPORTS_AGE_CATEGORIES = PROSPORTS_AGE_CATEGORIES;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        INDIA_STATES_AND_DISTRICTS,
        PROSPORTS_SUPPORTED_SPORTS,
        PROSPORTS_AGE_CATEGORIES
    };
}
