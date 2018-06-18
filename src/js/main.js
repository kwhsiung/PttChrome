import { App } from './pttchrome';
import { setupI18n } from './i18n';
import { getQueryVariable } from './util';
import { readValuesWithDefault } from '../components/ContextMenu/PrefModal';

function startApp() {
  // getQueryVariable: 給定一字串，回傳該字串在 query 中對應的值, e.g. url: www.google.com?one=1&two=2, getQueryVariable(one) // return 1
  // site: 好像是可以指定要連線到的站台位置
  var site = getQueryVariable('site');
  
  // TODO: 查明 from 與 keepAlive 之用途
  var from = getQueryVariable('from');
  var keepAlive = getQueryVariable('keepAlive');

  setupI18n();

  const app = new App({ from: from, keepAlive: keepAlive });

  // 開發者模式警告
  (process.env.DEVELOPER_MODE ? import('../components/DeveloperModeAlert')
    .then(({DeveloperModeAlert}) => new Promise((resolve, reject) => {
      const container = document.getElementById('reactAlert')
      const onDismiss = () => {
        ReactDOM.unmountComponentAtNode(container)
        resolve()
      }
      ReactDOM.render(
        <DeveloperModeAlert onDismiss={onDismiss} />,
        container
      )
    })) : Promise.resolve()
  ).then(() => {
    // NOTE: 連線！
    // connect.
    app.connect(getQueryVariable('site') || process.env.DEFAULT_SITE); // DEFAULT_SITE === 'wstelnet://localhost:8080/bbs' if process.env.NODE_ENV !== 'production'

    // TODO: Call onSymFont for font data when it's implemented.
    console.log("load pref from storage");
    app.onValuesPrefChange(readValuesWithDefault());
    app.setInputAreaFocus();
    $('#BBSWindow').show();
    //$('#sideMenus').show();
    app.onWindowResize();
  })
}

function loadTable(url) {
  return new Promise(function(resolve, reject) {
    $.ajax({
      url: url,
      processData: false,
      xhrFields: {
        responseType: 'arraybuffer'
      }
    }).done(function(data) {
      resolve(data);
    }).fail(function(jqXHR, textStatus, errorThrown) {
      console.log('loadTable failed: ' + textStatus + ': ' + url);
      reject();
    });
  });
}

function loadResources() {
  // 讀取字元轉換的 tables
  Promise.all([
    loadTable(require('../conv/b2u_table.bin')),
    loadTable(require('../conv/u2b_table.bin'))
  ]).then(function(binData) {
    window.lib = window.lib || {};
    window.lib.b2uArray = new Uint8Array(binData[0]);
    window.lib.u2bArray = new Uint8Array(binData[1]);
    $(document).ready(startApp);
  }, function() {
    // 其實就是 catch 的 callback
    console.log('loadResources failed');
  });
}

loadResources();
