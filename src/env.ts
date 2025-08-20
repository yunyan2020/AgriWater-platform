import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = __dirname + '/config/'

function getEnvPath() {
    return CONFIG_PATH + '.env.' + process.env.NODE_ENV
}
function getEnvBasePath() {
    return CONFIG_PATH + '.env'
}

if (process.env.NODE_ENV === undefined) {
    throw Error('Environment variable NODE_ENV must be set')
}
if (!fs.existsSync(getEnvPath())) {
    throw Error(`No configuration for the node environment found [path: "${path.resolve(getEnvPath())}"]`)
}

const result = dotenv.config({ path: getEnvPath() })
if (result.error !== undefined) {
    throw Error('.env-file parsing error')
}
const result2 = dotenv.config({ path: getEnvBasePath() })
if (result2.error !== undefined) {
    throw Error('.env-file parsing error')
}

function error_if_not_defined(name) {
    if (process.env[name] === undefined) {
        throw Error(`Environment variable "${name}" is not defined.`)
    }
}

export function get_bool(name) {
    error_if_not_defined(name)
    switch (process.env[name].toLowerCase()) {
        case 'true':
            return true
        case 'false':
            return false
        default:
            throw Error(`Environment variable "${name}" is not a valid boolean.`)
    }
}

export function get_string(name) {
    error_if_not_defined(name)
    return process.env[name]
}

export function get_int(name) {
    error_if_not_defined(name)
    let int = parseInt(process.env[name])
    if (Number.isNaN(int)) {
        throw Error(`Environment variable "${name}" is not a valid integer.`)
    }
    return int
}

export function get_array(name) {
    error_if_not_defined(name)
    let array = JSON.parse(process.env[name]);
    if (!Array.isArray(array)) {
        throw Error(`Environment variable "${name}" is not a valid array.`)
    }
    return array
}