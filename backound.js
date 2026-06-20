const express = require('express');
const axios = require('axios');
const xml2js = require('xml2js');
const app = express();
const PORT = 3000;

app.get('/api/download', async (req, res) => {
    const { placeId, mode } = req.query;

    if (!placeId) {
        return res.status(400).send('Missing Place ID');
    }

    try {
        // 1. Fetch the raw file from the Roblox API
        const robloxUrl = `https://assetdelivery.roblox.com/v1/asset/?id=${placeId}`;
        const response = await axios.get(robloxUrl, { responseType: 'text' });
        let fileData = response.data;

        // 2. If user requested "Map Only", parse and strip scripts
        if (mode === 'mapOnly') {
            // Note: This logic assumes the place file is in the .rbxlx (XML) format.
            // If binary (.rbxl), a byte-stream parser would be required instead.
            const parser = new xml2js.Parser();
            const builder = new xml2js.Builder();

            parser.parseString(fileData, (err, result) => {
                if (err) {
                    return res.status(500).send('Error parsing game file architecture.');
                }

                // Recursive function to strip script elements out of the game tree
                const stripScripts = (obj) => {
                    if (typeof obj !== 'object' || obj === null) return;

                    if (obj.Item) {
                        // Filter out common script classes
                        obj.Item = obj.Item.filter(item => {
                            const className = item.$ && item.$.className;
                            return !(className === 'Script' || className === 'LocalScript' || className === 'ModuleScript');
                        });

                        // Continue down the hierarchy
                        obj.Item.forEach(stripScripts);
                    }
                };

                stripScripts(result);
                fileData = builder.buildObject(result);
            });
        }

        // 3. Force browser download with the correct extension for Roblox Studio
        res.setHeader('Content-Disposition', `attachment; filename="place_${placeId}.rbxl"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.send(fileData);

    } catch (error) {
        res.status(500).send('Failed to fetch or process the asset. Ensure the game is uncopylocked.');
    }
});

app.listen(PORT, () => console.log(`Backend filtering running on port ${PORT}`));