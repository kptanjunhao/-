function setCookie(name,value)
{
    var expires_day = 1;
    var exp = new Date();exp.setTime(exp.getTime() + expires_day*24*60*60*1000);
    document.cookie = name + "="+ escape (value) + ";expires=" + exp.toGMTString();
}

//读取cookies
function getCookie(name)
{
    var arr,reg=new RegExp("(^| )"+name+"=([^;]*)(;|$)");
    if(arr=document.cookie.match(reg))return unescape(arr[2]);
    else return null;
}

//删除cookies
function delCookie(name)
{
    var exp = new Date();exp.setTime(exp.getTime() - 1);
    var cval=getCookie(name);
    if(cval!=null) document.cookie= name + "="+cval+";expires="+exp.toGMTString();
}
if ("WebSocket" in window) {
    var ws,wst;
    var count = 0;
    var isReconnecting = false;
    var restoreJSON = getCookie("restoreJSON");
    var onopen = function () {
        // Web Socket 已连接上
        sys_print("已连接至服务器")
        if(restoreJSON) wsSendO({"action":"restoreUser","data":restoreJSON});
        wsSendO({"action":"getGroupList"});
    };
    var onmessage = function (evt) {
        var received_msg = evt.data;
        console.log(received_msg)
        try {
            var json = JSON.parse(received_msg)
            if(json.server){
                if(json.user)setCookie("restoreJSON",received_msg);
            }else if(json.userSetName && json.userSetName.id == user.id){
                // 如果用户更新自己的昵称，保存一份到本地，下次还原。
                restoreJSON = getCookie("restoreJSON");
                restoreJSONObject = JSON.parse(restoreJSON);
                restoreJSONObject.user = json.user || json.userSetName;
                restoreJSON = JSON.stringify(restoreJSONObject);
                setCookie(restoreJSON);
            }
            wsOnMessage(json)
        } catch (error) {
            console.log(error)
            sys_print(error)
        }
    };
    var onclose = function () {
        // 关闭 websocket
        sys_print("CLOSE:与服务器断开了连接，2秒后重连...")
        setTimeout(() => {
            reconnection();
        }, 2000);
    };
    var onerror = function(){
        // 关闭 websocket
        sys_print("ERROR:与服务器断开了连接，3秒后重连...")
        setTimeout(() => {
            reconnection();
        }, 3000);
    }
    var connect = function() {
        // 打开一个 web socket
        ws = new WebSocket("ws://"+window.location.host.split(":")[0]+":8889");
        ws.onopen = onopen;
        ws.onmessage = onmessage;
        ws.onclose = onclose;
        ws.onerror = onerror;
    }
    var reconnection = function() {
        if(isReconnecting)return;
        isReconnecting = true;
        count = count + 1;
        //1与服务器已经建立连接
        if (count >= 10 || ws.readyState == 1) {
            clearTimeout(wst);
        } else {
            //2已经关闭了与服务器的连接
            if (ws.readyState == 3) {
                sys_print("重连尝试中...次数:【" + count + "】");
                connect();
            }
            //0正尝试与服务器建立连接,2正在关闭与服务器的连接
            wst = setTimeout(function() {reconnection();}, 3000);
        }
        isReconnecting = false;
    }
    connect();
}else{
    // 浏览器不支持 WebSocket
    sys_alert("您的浏览器不支持 WebSocket!")
    // sys_print("您的浏览器不支持 WebSocket!")
}
function wsSend(str)  {
    if(ws){
        ws.send(str);
    }else{
        sys_alert("您的浏览器不支持 WebSocket!")
    }
};
function wsSendO(data) {
    wsSend(JSON.stringify(data));
};
function wsSendAction(action){
    wsSendO({"action":action});
}