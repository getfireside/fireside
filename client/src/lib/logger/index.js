import ConsoleAppender from './appenders/console.js';
import MemoryAppender from './appenders/memory.js';
import PostJSONAppender from './appenders/postjson.js';

import LoggingController from './controller.js';
import Logger from './logger.js';

export {ConsoleAppender, MemoryAppender, PostJSONAppender};
export const appenders = {
    ConsoleAppender, MemoryAppender, PostJSONAppender
}

export {LoggingController, Logger};
export default Logger;