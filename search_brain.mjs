import { spawn } from 'child_process';

const query = 'contacted-leads campaign outreach';
console.log(`Searching brain for: "${query}"`);

// Since we can't directly call tools from bash, let's just note this for now
