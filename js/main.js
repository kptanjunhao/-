function sys_print(str) {
    u_print(str, "red");
}
function u_print(str, color) {
    var style = "";
    if (color) {
        style += "color: " + color;
    }
    var elem = "<div style='" + style + "'>" + str + "</div>"
    document.getElementById("rs").innerHTML = document.getElementById("rs").innerHTML + elem;
    document.getElementById("rs").scroll({ top: document.getElementById("rs").scrollHeight, left: 0, behavior: 'smooth' })
}
function sys_alert(str, color, title){
    var style = "";
    if (color) {
        style += "color: " + color;
    }
    var elem = "<div style='" + style + "'>" + str + "</div>"
    var d = dialog({
        title: title || "提示",
        content: elem,
        cancel: false,
        ok: function () {}
    });
    d.show();
}
function test(e) {
    console.log(e);
}
// 禁止CANVA滚动
document.body.addEventListener('touchmove',function(e){e.target.tagName!="CANVAS"||e.preventDefault();},{passive:false}); 

// 添加颜色区域
var pen_colors = ["#874A00","#FFCC99","#4E0064","#FF4AB7","#0202F6","#1AB3F5","#45FF03","#FFFF00","#FF7000","#F50000","#FFFFFF","#BFBFBF","#000000"];
var pen_colors_elem = "";
for(var pi in pen_colors){
    var c = pen_colors[pi];
    pen_colors_elem += "<button class='pen-color-btn' onclick='updateColor(\""+c+"\");' style='background:"+c+";'></button>";
}
document.getElementById("color-area").innerHTML = pen_colors_elem;

var user = {};
var group = {};
var mindTimer;
var users, messages, states;
var createGroup = function () {
    wsSendAction("postAddGroup");
};
var enterGroup = function (group_id) {
    wsSendO({ "action": "enterGroup", "id": group_id });
}
var sendMessage = function () {
    var send_msg = document.getElementById("msg").value;
    if (!send_msg) return;
    var data = {
        "action": "postMessage",
        "message": send_msg
    };
    wsSendO(data);
    document.getElementById("msg").value = "";
};
var setName = function () {
    var new_name = document.getElementById("name").value;
    if (user.name == new_name) return;
    var data = {
        "action": "setName",
        "name": new_name
    }
    wsSendO(data);
};
function toBackList(){
    wsSendAction("postBackGroup");
}
function toReady() {
    delayButton("ready-button");
    wsSendAction("postReady");
}
function toChangeQuestion() {
    delayButton("change-button");
    wsSendAction("postChangeTitle");
}
function delayButton(id){
    var d_btn = document.getElementById(id);
    d_btn.setAttribute("disabled", "");
    setTimeout(function () { d_btn.removeAttribute("disabled"); }, 2000)
}
function post(x, y, width, color, state) {
    // 0开始 1绘制 2结束
    // 处理：传百分比坐标进去。
    var f_num = (num) => { return String(num).replace(/^(.*\..{4}).*$/,"$1"); }
    tx = f_num(x / c_width);
    ty = f_num(y / c_width);
    tw = f_num(width / c_width);
    wsSendO({
        "action": "postState",
        "state": [tx,ty,tw,color,state]
    });
}
function postClear() {
    wsSendAction("postClearState");
}
var wsOnMessage = function (json) {
    if (json.errMSG) {
        sys_alert(json.errMSG.msg,"red");
    }
    if (json.user || json.userSetName) {
        // 设置个人信息
        user = json.user || user;
        if(json.userSetName && json.userSetName.id == user.id){
            user = json.userSetName;
        }
        document.getElementById("name").value = user.name;
    }
    if (json.groups) {
        var list_area = "<ul class='group-list'>";
        for (var i in json.groups) {
            var g = json.groups[i];
            list_area += genGroupItem(g);
        }
        list_area += "</ul>"
        document.getElementById("group_list").innerHTML = list_area;
    }
    if (json.group) {
        group = json.group
        // 没开始的时候大家随便画
        if(!group.isStart){
            setCanvasEnabled(true);
        }
        if(group.isBaseGroup){
            // 退出房间
            // 返回大厅之后要获取房间列表
            wsSendAction("getGroupList");
            document.getElementById("room-area").style.display = "none";
            document.getElementById("list-area").style.display = "";
        }else{
            document.getElementById("room-area").style.display = "";
            document.getElementById("list-area").style.display = "none";
            group.messages = group.msgs;
        }
        // 房间名字
        document.getElementById("room-name").innerHTML = group.name || (group.creator.name+"的房间");
        // 更新用户列表。
        updateUserList(group.users);
        // 清空聊天框
        document.getElementById("rs").innerHTML = "";
        // 清空画板
        clearCanvas(true);
        // 更新换题目按钮的状态
        document.getElementById("change-button").style.display = (group.isStart&&group.current_user.id==user.id)?"block":"none";
        // 准备按钮
        document.getElementById("ready-button").style.display = group.isStart?"none":"block";
        dealUMS(group);
    }
    if (json.users_enter || json.userSetName || json.users_out || json.users || json.states || json.messages) {
        dealUMS(json);
    }
    if (json.gameMsg) {
        // 打印信息
        for (var i in json.gameMsg.msg) {
            sys_print(json.gameMsg.msg[i]);
        }
        // 准备信息
        if (json.gameMsg.action && json.gameMsg.action == "ready"){
            updateUserListByUser(json.gameMsg.user);
            updateUserList(users);
            if (json.gameMsg.user.id == user.id){
                user = json.gameMsg.user;
                document.getElementById("ready-button").innerHTML = user.isReady ? "取消准备" : "准备";
            }
        }
        // 游戏结束，弹出用户得分信息
        if (json.gameMsg.msg[0]=="游戏结束"){
            var scores = "<div>";
            var g_us = json.gameMsg.group.users;
            for(var i in g_us){
                var gu = g_us[i];
                scores += "<div>"+gu.name+" : "+gu.score+"</div>";
            }
            sys_alert(scores+"</div>",undefined,"游戏结束");
            // 恢复工具栏
            ["clear-button","color-tool","width-tool","ready-button"].forEach(function(e){document.getElementById(e).style.display="";});
        }
        // 房间内信息
        if (json.gameMsg.group) {
            group = json.gameMsg.group;
            // 更新用户列表。
            updateUserList(group.users);
            if(!group.isStart){
                // 如果游戏结束。
                // 大家都可以涂鸦。
                setCanvasEnabled(true);
            }
            var startTime = new Date(group.startTime).getTime();
            var timeDelta = (new Date().getTime() - startTime) / 1000;
            if (timeDelta > 60) {
                clearTimeout(mindTimer);
                mindTimer = undefined;
            }
        }
        // 更换题目
        if (json.gameMsg.action && json.gameMsg.action == "changeTitle"){
            group = json.gameMsg.group;
            if(group.current_user.id == user.id){
                var title_msg = "新题目：" + group.q_title;
                sys_print(title_msg);
                sys_alert(title_msg);
                showToast(title_msg,0,60);
            }else{
                mindQuestion();
            }
        }
    }
    if (json.gameStart) {
        group = json.gameStart.group;
        // 更新用户列表。
        updateUserList(group.users);
        // 开始后隐藏准备按钮
        document.getElementById("ready-button").style.display = "none";
        // 游戏开始，隐藏掉那些不是画图人的工具栏
        var toolDisplay = group.current_user.id == user.id?"":"none";
        ["clear-button","color-tool","width-tool","change-button"].forEach(function(e){document.getElementById(e).style.display=toolDisplay;});
        showToast("玩家【" + group.current_user.name + "】开始画图！");
        if (group.current_user.id == user.id) {
            // 当前画图的人
            setCanvasEnabled(true);
            var title_msg = "当前题目：" + group.q_title;
            sys_print(title_msg);
            sys_alert(title_msg);
            showToast(title_msg,0,60);
        } else {
            // 要猜图的人
            setCanvasEnabled(false);
            mindQuestion();
        }
    }
};
function mindQuestion(){
    if (mindTimer) clearTimeout(mindTimer);
    mindTimer = setTimeout(function () {
        if (!group.isStart) return;
        showToast("提示1：" + group.q_title.length + "个字",0,5);
        if (mindTimer) {
            mindTimer = setTimeout(function () {
                mindTimer = undefined;
                if (!group.isStart) return;
                showToast("提示2：" + group.q_type,0,10);
            }, 5000);
        }
    }, 5000);
}
function dealUMS(json) {
    // 如果是涉及到其他用户信息变更的，需要判断一下是否有剩余的messages没处理
    // 如果传进来的是用户列表，则更新用户列表后，处理没处理的messages和state
    users = json.users || group.users || users || [];
    messages = json.messages || messages;
    states = json.states || states;
    if (json.users_enter || json.userSetName) { // 如果有用户进来，如果列表中存在这个用户，更新该用户信息，如果没有就新增。
        u_remote = json.users_enter || json.userSetName;
        updateUserListByUser(u_remote);
        if (json.userSetName) {
            showToast("系统信息: " + u_remote.old_name + " 更名为 " + u_remote.name);
        } else {
            showToast("系统信息:" + (u_remote.id != user.id ? u_remote.name : "你") + "加入了" + (group.name || "房间"));
        }
        // 更新用户列表。
        updateUserList(users);
    }
    if (json.users_out) { // 如果用户退出，删除该用户
        var idx;
        for (var i in users) {
            if (users[i].id == json.users_out.id) { idx = i; break; }
        }
        if (idx) {
            sys_print("系统信息:" + json.users_out.name + "离开了" + (group.name || "房间"))
            users.splice(idx, 1);
        }
        // 更新用户列表。
        updateUserList(users);
    }
    if (json.states) {
        //  画图
        if (states instanceof Array) {
            for (var i in states) {
                // "state": [tx,ty,tw,lineWidth,lineColor,state]
                var s_i = states[i];
                var e = {
                    "clientX": s_i[0] * c_width,
                    "clientY": s_i[1] * c_width,
                    "isRemote": true
                };
                lineWidth = s_i[2] * c_width
                $("line-width").val(s_i[2]).change();
                lineColor = s_i[3]
                document.getElementById("line-color").style.background = lineColor;
                if (s_i[4] == 0) drawStart(e);
                if (s_i[4] == 1) drawCanvas(e);
                if (s_i[4] == 2) drawEnd(e);
            }
        } else {
            if (states == "clear") clearCanvas(true);
            return;
        }
        // 处理完显示之后销毁临时保存。
        states = undefined;
    }
    if (messages) {
        for (var i in messages) {
            var uid = messages[i].user_id;
            var unm = messages[i].name;
            var msg = messages[i].message;
            if (uid == user.id) {
                u_print("我 : " + msg);
            } else {
                u_print((unm || "未知网友") + " : " + msg);
            }
        }
        // 处理完显示之后销毁临时保存。
        messages = undefined;
    }
}
// 返回True代表是更新的，False代表插入的
function updateUserListByUser(user){
    var isUpdate = false;
    for (var i in users) {
        if (users[i].id == user.id) {
            for(var pk in user){
                users[i][pk] = user[pk];
            }
            isUpdate = true;
            break;
        }
    }
    if (!isUpdate) users.push(user);
    return isUpdate;
}
function updateUserList(users){
    var numText = ['一','二','三','四','五','六','七','八']
    var elem = "";
    for(var i in users){
        var u = users[i];
        var u_sufx = (u.score || 0)+"分  "+(u.isReady?"已准备":"");
        elem += "<div class='user-list-item'><div class='user-list-item-num'>"+numText[i]+"</div>"+u.name+"<div class='user-list-item-score'>"+u_sufx+"</div></div>";
    }
    document.getElementById("user_list").innerHTML = elem;
}
function updateColor(c_hex){
    lineColor = c_hex;
    document.getElementById("line-color").style.background = c_hex;
}
document.getElementById("line-width").onchange = function(){
    lineWidth = this.value/1000.0*c_width;
}
function genGroupItem(g){
    var statu = g.isStart?"已开始":"等待中";
    statu += " 在线人数:"+g.users_count+"人";
    return "<li><button onclick='enterGroup(\""+g.id+"\");'>" + 
        (g.name || g.creator.name + "的房间") + 
        "</button><div class='list-desc'>"+statu+"</div></li>";
}
var toastTimer;
function showToast(content,delay,duration){
    delay = delay || 0;
    duration = duration || 3;
    if(toastTimer){clearTimeout(toastTimer);}
    document.getElementById("minder").classList.remove("toast-show")
    document.getElementById("minder").classList.remove("toast-hide")
    document.getElementById("minder").innerHTML = content;
    toastTimer = setTimeout(function(){
        document.getElementById("minder").classList.remove("toast-hide")
        document.getElementById("minder").classList.add("toast-show");
        toastTimer = setTimeout(function(){
            document.getElementById("minder").classList.remove("toast-show");
            document.getElementById("minder").classList.add("toast-hide");
        },duration*1000)
    },delay*1000)
}