const Difficulty = { //難度
    Easy: 'Easy',
    Medium: 'Medium',
    Hard: 'Hard'
}

const Type = { //題目類型
    WebExploitation: 'WebExploitation',
    ReverseEngineering: 'ReverseEngineering',
    Forensics: 'Forensics',
    BinaryExploitation: 'BinaryExploitation',
    Cryptography: 'Cryptography',
    GeneralSkills: 'GeneralSkills',
    ArtificialIntelligence: 'ArtificialIntelligence',
    Blockchain: 'Blockchain',
}

const record = { //解題記錄格式
    id: 0, //記錄ID
    questionName: '', //題目名稱
    time: '', //記錄時間
    difficulty: Difficulty.Easy, //難度(有限定的幾種，參考Difficulty物件)
    type: Type.WebExploitation, //題目類型(有限定的幾種，參考Type物件)
    tags: [], //題目標籤，有０個或多個，使用者自訂(不做限制)
    link: '' //題目連結
}

module.exports = {
    record,
    Difficulty,
    Type
}