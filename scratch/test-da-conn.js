
import { directAdminAPI } from './src/lib/directadmin-adapter.js';

async function testConnection() {
  console.log('Testing DirectAdmin connection...');
  try {
    const sites = await directAdminAPI.listWebsites();
    console.log('Connection Successful!');
    console.log('Sites found:', sites.length);
  } catch (error) {
    console.error('Connection Failed:', error.message);
  }
}

testConnection();
