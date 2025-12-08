const API_KEY = 'gU0kbh06m0+vfTpKSgCfUSYl8bTfFddzC1sIQYyze9R7HfOFZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1kVk1HdGlhREEyYlRBcmRtWlVjRXRUWjBObVZWTlpiRGhpVkdaR1pHUjZRekZ6U1ZGWmVYcGxPVkkzU0daUFJpSXNJbTkzYm1WeVNXUWlPaUl5TnpZME9ESTVNRFE0SWl3aVpYaHdJam94TnpZME1EQTVNREU0TENKcFlYUWlPakUzTmpRd01EVTBNVGdzSW01aVppSTZNVGMyTkRBd05UUXhPSDAuT0wzdmdPUDRWOGJuNU1JLS1PalU4NFlYMVhpMHdZMXduWkZJU2owbTJTRFVHdlBYOEl0a3hrTm9DTEFVRGY1aVlWYkVjR19QclJDVDRVVm9RWFJSR3BSTzNmelJsTXEzZGRoSE1iLTdCUFFXSTk1U3R5NzZqYXZnTGtYYlc1X3pYZEQtSXlPQTg5cFR3Yk9vY1EzVEllamZEVW1aRGtua0JCLUl3Mlk1NTJmR3ZHUkQ1dy1YUWZlVWJzdkNJMThOUW5XSG9pcWtwYkF2b3ZJVjhiTWlRU1BVX3UxNXEtVVBVVDBuT2ozQmJhdG9aVEtOUU9CeDBNbldsRlBrM3VfMk9Hc3JJMnU0XzYwVk9Pa29yQUdYeFpvdXFBcUdmUGpBWk9zMVdkRXd3OG9JX2Q3OTNiTm1kWFQ4VDNCMGstelF4alhvXzZjRlVmWVVsOF9IOGZfcjln';  
const UNIVERSE_ID = 9230740552;   

const formData = new FormData();
formData.append('name', 'test sigma');
formData.append('description', 'rizz? Desc');
formData.append('price', '494393'); 
formData.append('isForSale', 'true');

async function testListGamePasses() {
  const url = `https://apis.roblox.com/game-passes/v1/universes/${UNIVERSE_ID}/game-passes?limit=1`;
  const res = await fetch(url, {
    headers: { 'x-api-key': API_KEY }
  });
  const text = await res.text();
  console.log('🔍 LIST TEST Status:', res.status);
  if (res.ok) {
    const data = JSON.parse(text);
    console.log('✅ API Key WORKS! Existing game passes:', data.gamePasses.map(gp => ({id: gp.id, name: gp.name, isForSale: gp.isForSale})));
  } else {
    console.error('❌ API Key FAILS:', text);
    return false;
  }
  return true;
}

async function createGamePass() {
  const url = `https://apis.roblox.com/game-passes/v1/universes/${UNIVERSE_ID}/game-passes`;  // OFFICIAL

  console.log('POST URL:', url);
  console.log('Form Fields:');
  for (const [key, value] of formData.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY
    },
    body: formData
  });

  const text = await response.text();
  console.log('Response Headers:', Object.fromEntries([...response.headers.entries()]));

  if (!response.ok) {
    console.error('❌ FAILED');
    console.error('Status:', response.status);
    console.error('Body:', text);
    if (response.status === 415) {
      console.error('💡 Still 415? Check if imageFile is required – try adding a PNG.');
    } else if (response.status === 400) {
      console.error('💡 400? Invalid field (e.g., price <25, name too long).');
    }
    return;
  }

  const data = JSON.parse(text);
  console.log('✅ CREATED!');
  console.log('Game Pass ID:', data.gamePassId);  
  console.log('Name:', data.name);
  console.log('Price Info:', data.priceInformation?.defaultPriceInRobux ?? 'N/A');
  console.log('Icon ID:', data.iconAssetId ?? 'None (add later)');
  console.log('Link: https://www.roblox.com/game-pass/' + data.gamePassId + '/' + data.name.toLowerCase().replace(/ /g, '-'));
}

(async () => {
  const keyOk = await testListGamePasses();
  if (keyOk) createGamePass();
})();