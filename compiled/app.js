'use strict';

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _request = require('request');

var _request2 = _interopRequireDefault(_request);

var _nodeUuid = require('node-uuid');

var _nodeUuid2 = _interopRequireDefault(_nodeUuid);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const token = process.env.TODOIST_TOKEN;

const addTask = (token, sync_token, project_id, content, note, callback) => {
  const item_id = _nodeUuid2.default.v4();
  const note_id = _nodeUuid2.default.v4();
  const commands = JSON.stringify([{
    'type': 'item_add',
    'temp_id': item_id,
    'uuid': _nodeUuid2.default.v4(),
    'args': {
      'project_id': project_id,
      'content': content
    }
  }, {
    'type': 'note_add',
    'temp_id': note_id,
    'uuid': _nodeUuid2.default.v4(),
    'args': {
      'item_id': item_id,
      'content': note
    }
  }]);
  const options = {
    'url': 'https://todoist.com/api/v7/sync',
    'method': 'POST',
    'form': {
      'token': token,
      'sync_token': sync_token,
      'resource_types': '["projects", "items"]',
      'commands': commands
    }
  };
  (0, _request2.default)(options, (error, res, body) => {
    if (error) {
      console.log("[ERROR]addTask: request: error: %s", error);
    } else if (res.statusCode != 200) {
      console.log("[ERROR]addTask: request: status error: code=%d body=%s", res.statusCode, body);
    } else {
      callback(res, body);
    }
  });
};

// Only for health check
_http2.default.createServer((req, res) => {
  if (req.url == '/webhook' && req.method == 'POST') {
    let body = '';
    req.on('data', dat => {
      body += dat;
    });
    req.on('end', () => {
      const jsonBody = JSON.parse(body);
      const title = jsonBody.title;
      const url = jsonBody.html_url;
      if (jsonBody.action == "opened") {
        const options = {
          'url': 'https://todoist.com/api/v7/sync',
          'method': 'POST',
          'form': {
            'token': token,
            'sync_token': '*',
            'resource_types': '["projects"]'
          }
        };
        (0, _request2.default)(options, (error, res, body) => {
          if (error) {
            console.log("[ERROR]http.createServer: req.on: request: error: %s", error);
          } else if (res.statusCode != 200) {
            console.log("[ERROR]http.createServer: req.on: request: status error: code=%d body=%s", res.statusCode, body);
          } else {
            const jsonBody = JSON.parse(body);
            const sync_token = jsonBody.sync_token;
            if (!sync_token) {
              console.log("[ERROR]http.createServer: req.on: request: sync_token is empty or undefined: sync_token=%s", sync_token);
            } else {
              let project_id = "";
              for (let pj of jsonBody.projects) {
                if (pj.inbox_project) {
                  project_id = pj.id;
                  break;
                }
              }
              if (project_id == "") {
                console.log("[ERROR]http.createServer: req.on: request: inbox project not found: body=%s", body);
              } else {
                addTask(token, sync_token, project_id, title, url, (res, body) => {
                  const id = JSON.parse(body).id;
                  console.log("[INFO]task added: title=%s url=%s", title, url);
                });
              }
            }
          }
        });
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  }
}).listen(8080);