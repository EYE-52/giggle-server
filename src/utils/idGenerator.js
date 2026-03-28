const generateId = (prefix) => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 random chars
  return `${prefix}_${timestamp}_${randomSuffix}`;
};

const generateSquadCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += "-";
  for (let i = 0; i < 3; i++) {
    result += Math.floor(Math.random() * 10); // 3 random digits
  }
  return result;
};

module.exports = { generateId, generateSquadCode };
