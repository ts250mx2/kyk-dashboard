import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { getSchema } from '../src/lib/db';

(async () => {
    try {
        console.log('Fetching database schema...');
        const { tables, foreignKeys } = await getSchema();

        let markdown = '# Database Schema\n\n';

        markdown += '## Tables\n\n';
        for (const [tableName, columns] of Object.entries(tables)) {
            markdown += `### ${tableName}\n\n`;
            markdown += '| Column Name | Data Type |\n';
            markdown += '| :--- | :--- |\n';
            columns.forEach(col => {
                // col format is "Name (Type)"
                const match = col.match(/^(.*) \((.*)\)$/);
                if (match) {
                    markdown += `| ${match[1]} | ${match[2]} |\n`;
                } else {
                    markdown += `| ${col} | - |\n`;
                }
            });
            markdown += '\n';
        }

        if (foreignKeys.length > 0) {
            markdown += '## Relationships\n\n';
            foreignKeys.forEach(fk => {
                markdown += `- ${fk}\n`;
            });
            markdown += '\n';
        }

        const outputPath = path.join(process.cwd(), 'database-schema.md');
        fs.writeFileSync(outputPath, markdown);
        console.log(`Schema saved to ${outputPath}`);
        process.exit(0);
    } catch (error) {
        console.error('Failed to generate schema:', error);
        process.exit(1);
    }
})();
