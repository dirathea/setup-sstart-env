const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

/**
 * Parse environment variable output from sstart env command
 * Expected format: KEY=VALUE (one per line)
 */
function parseEnvOutput(output) {
  const envVars = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue; // Skip empty lines and comments
    }
    
    // Parse KEY=VALUE format
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2];
      envVars[key] = value;
    }
  }
  
  return envVars;
}

async function run() {
  try {
    const config = core.getInput('config', { required: true });
    const version = core.getInput('version') || '0.0.2';

    // Determine platform (only darwin and linux supported)
    const platform = process.platform;
    const arch = process.arch;
    
    if (platform !== 'darwin' && platform !== 'linux') {
      core.setFailed(`Unsupported platform: ${platform}. Only darwin and linux are supported.`);
      return;
    }
    
    let os = platform === 'darwin' ? 'Darwin' : 'Linux';
    
    // Normalize architecture
    let architecture = arch;
    if (architecture === 'x64') {
      architecture = 'amd64';
    } else if (architecture === 'arm64') {
      architecture = 'arm64';
    }
    
    const platformString = `${os}_${architecture}`;
    core.info(`Detected platform: ${platformString}`);

    // Build download URL from GitHub releases
    // Normalize version (remove 'v' prefix if present, add it back for URL)
    const normalizedVersion = version.startsWith('v') ? version : `v${version}`;
    const downloadUrl = `https://github.com/dirathea/sstart/releases/download/${normalizedVersion}/sstart_${platformString}.tar.gz`;

    // Download binary archive
    const binaryName = 'sstart';
    const archivePath = path.join(process.cwd(), `sstart_${platformString}.tar.gz`);
    const binaryPath = path.join(process.cwd(), binaryName);
    
    core.info(`Downloading sstart ${normalizedVersion} from: ${downloadUrl}`);
    
    try {
      await downloadFile(downloadUrl, archivePath);
    } catch (error) {
      core.setFailed(`Could not download sstart binary: ${error.message}`);
      return;
    }

    // Extract the tar.gz archive
    core.info('Extracting archive...');
    try {
      await exec.exec('tar', ['-xzf', archivePath, '-C', process.cwd()]);
      // Clean up the archive
      fs.unlinkSync(archivePath);
    } catch (error) {
      core.setFailed(`Could not extract sstart binary: ${error.message}`);
      return;
    }

    // Make binary executable
    await exec.exec('chmod', ['+x', binaryPath]);

    // Add to PATH
    core.addPath(process.cwd());
    core.info(`Added ${process.cwd()} to PATH`);

    // Write config to .sstart.yml
    const configPath = path.join(process.cwd(), '.sstart.yml');
    fs.writeFileSync(configPath, config, 'utf8');
    core.info('Created .sstart.yml configuration file');

    // Run sstart env and capture output
    core.info('Running sstart env...');
    let output = '';
    let errorOutput = '';
    
    const exitCode = await exec.exec(binaryPath, ['env'], {
      cwd: process.cwd(),
      listeners: {
        stdout: (data) => {
          output += data.toString();
        },
        stderr: (data) => {
          errorOutput += data.toString();
        }
      }
    });

    if (exitCode !== 0) {
      core.setFailed(`sstart env exited with code ${exitCode}`);
      if (errorOutput) {
        core.error(`Error output: ${errorOutput}`);
      }
      return;
    }

    // Parse output and set GitHub environment variables
    if (!output.trim()) {
      core.warning('sstart env produced no output');
      return;
    }

    core.info('Parsing environment variables from sstart env output...');
    const envVars = parseEnvOutput(output);
    
    // Set GitHub environment variables one by one
    let count = 0;
    for (const [key, value] of Object.entries(envVars)) {
      core.exportVariable(key, value);
      count++;
    }
    
    core.info(`Successfully set ${count} environment variable(s)`);
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        // Handle redirect
        return downloadFile(res.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });

      fileStream.on('error', (error) => {
        fs.unlink(destPath, () => {}); // Delete the file on error
        reject(error);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

run();

