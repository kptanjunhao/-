# coding=utf-8
import json
import asyncio
from user import USER
from question import randomQuestion
from random import choice,shuffle
from datetime import datetime,timedelta

class Group:
    GROUP_LIST = set()
    @classmethod
    def append(cls,group):
        if group not in cls.GROUP_LIST:
            cls.GROUP_LIST.add(group)

    @classmethod
    def remove(cls,group):
        if group in cls.GROUP_LIST:
            cls.GROUP_LIST.remove(group)

    @classmethod
    def getBy(cls,id):
        for group in cls.GROUP_LIST:
            if group.id == id:
                return group
        return None

    @classmethod
    def findUserGroup(cls,user):
        for group in cls.GROUP_LIST:
            for u in group.users:
                if u.id == user.id:
                    return group
        return None

    def __init__(self,*args):
        self.users = set()
        self.name = None
        self.isBaseGroup = len(args) == 0 # 基础群组，大群，只存储用户，作为一个临时大型聊天室，不保存消息。
        self.detectRoundHandler = None
        self.detectGroupHandler = None
        if not self.isBaseGroup:
            (id,creator) = args
            self.isStart = False
            self.users.add(creator)
            self.id = id
            self.creator = creator
            self.msgs = []
            self.states = []


    def minDic(self):
        return {
            "isBaseGroup": self.isBaseGroup,
            "isStart": self.isStart,
            "id": self.id,
            "creator": self.creator.minDic(),
            "users_count": len(self.users),
            "name": self.name
        }

    def dic(self):
        rs = self.__dict__.copy()
        # 特殊处理需要简化的字段
        if "creator" in rs and rs["creator"] is not None:
            rs["creator"] = self.creator.minDic()
        if "current_user" in rs and rs["current_user"] is not None:
            rs["current_user"] = self.current_user.minDic()
        if "remain_current_users" in rs and rs["remain_current_users"] is not None:
            rs["remain_current_users"] = [it.minDic() for it in self.remain_current_users]
        if "q_correct_users" in rs and rs["q_correct_users"] is not None:
            rs["q_correct_users"] = [it.minDic() for it in self.q_correct_users]
        # 通俗化处理其他字段
        for k in list(rs.keys()):
            if "Handler" in k:
                del rs[k]
            elif isinstance(rs[k],(set,list)):
                rs[k] = [(it.dic() if hasattr(it,"dic") else it) for it in rs[k]]
            elif isinstance(rs[k],(USER,Group)):
                rs[k] = rs[k].dic()
            elif isinstance(rs[k],datetime):
                rs[k] = rs[k].strftime('%Y-%m-%d %H:%M:%S')
        return rs

    # ------------------ 房间内推送方法

    @classmethod
    def group_list_event_all(cls):
        return json.dumps({"groups":[g.minDic() for g in cls.GROUP_LIST]})

    def group_event(self):
        return json.dumps({"group":self.dic()})
    
    def state_event(self,u_id,state):
        return json.dumps({"states":[state]})

    def state_event_all(self):
        return json.dumps({"states":self.states})

    def msg_event_all(self):
        return json.dumps({"messages":self.msgs})

    def users_event(self,user,action):
        return json.dumps({action:user.dic()})

    def users_event_all(self):
        return json.dumps({"users":[user.dic() for user in self.users]})


    async def notify_msg(self,user,msg):
        msg_object = {"user_id":user.id,"name":user.name,"message":msg}
        if not self.isBaseGroup:
            self.msgs.append(msg_object)
        # 当前用户发送消息的时候，向所有用户发送这条数据
        if self.users:  # asyncio.wait doesn't accept an empty list
            message = json.dumps({"messages":[msg_object]})
            await asyncio.wait([user.send(message) for user in self.users])

    async def notify_state_clear(self,exclude_id):
        # 当前用户有画图数据传进来的时候，向所有用户除自己发送这条数据
        if self.users and not self.isBaseGroup:  # asyncio.wait doesn't accept an empty list
            message = json.dumps({"states":"clear"})
            for user in self.users:
                if user.id != exclude_id:
                    await user.send(message)

    async def notify_state_exclude(self,state,u_id):
        if not self.isBaseGroup:
            # 当前用户有画图数据传进来的时候，向所有用户除自己发送这条数据
            self.states.append(state)
            if self.users:  # asyncio.wait doesn't accept an empty list
                message = self.state_event(u_id,state)
                for user in self.users:
                    if user.id != u_id:
                        await user.send(message)

    async def notify_users(self,user,action):
        # 有用户进来或者退出房间的时候，向所有用户发送这条数据
        if self.users:  # asyncio.wait doesn't accept an empty list
            message = self.users_event(user,action)
            await asyncio.wait([u.send(message) for u in self.users])

    async def notify_all_O(self,data,action):
        # 向房间所有用户推送消息。
        if self.users:  # asyncio.wait doesn't accept an empty list
            message = json.dumps({action:data})
            await self.notify_all(message)

    async def notify_all(self,msg):
        # 有用户进来或者退出房间的时候，向所有用户发送这条数据
        if self.users:  # asyncio.wait doesn't accept an empty list
            await asyncio.wait([user.send(msg) for user in self.users])

    # ------------------ 房间内推送方法  END

    def restore_user(self,user):
        # 恢复房间内定义的user属性
        user.isReady = None
        user.score = None

    async def nextRound(self,round):
        await self.notify_state_clear(-1)
        # 取消60秒计时监测
        if self.detectRoundHandler is not None:
            self.detectRoundHandler.cancel()
        if round == 0:
            # 第一轮的初始化准备
            self.remain_current_users = list(self.users)
            shuffle(self.remain_current_users)
            self.game_round = 0
            self.q_correct_users = []
            for u in self.users:
                u.score = 0
        if len(self.remain_current_users) == 0:
            # 所有人已经画完了，游戏结束
            self.isStart = False
            self.startTime = None
            self.current_user = None
            self.game_round = None
            self.q_type = None
            self.q_title = None
            self.q_correct_users = None
            for u in self.users:
                u.isReady = False
            await self.notify_all_O({
                    "group": self.dic(),
                    "msg": ["游戏结束"]
                },"gameMsg")
        else:
            (q_type,q_title) = randomQuestion()
            self.isStart = True
            self.startTime = datetime.now()
            # 从剩余的画手中抽一个
            self.current_user = self.remain_current_users.pop()
            self.game_round += 1
            self.q_type = q_type
            self.q_title = q_title
            self.q_correct_users = []
            await self.notify_all_O({"group":self.dic()},"gameStart")
            # 开始游戏后60秒本轮超时
            loop = asyncio.get_event_loop()
            self.detectRoundHandler = loop.call_later(58,self.roundExpire,loop)


    def roundExpire(self,loop):
        self.isStart = False
        self.startTime = None
        tasks = [self.notify_all_O({"group": self.dic(),"msg": ["60秒到。"]},"gameMsg"),self.nextRound(self.game_round)]
        [asyncio.run_coroutine_threadsafe(t,loop) for t in tasks]

    async def changeTitle(self,user):
        (q_type,q_title) = randomQuestion()
        self.q_type = q_type
        self.q_title = q_title
        await self.notify_all_O({"action": "changeTitle","group": self.dic(),"msg": ["玩家【"+user.name+"】"+"画不出来，选择更换题目。"]},"gameMsg")

    async def ready(self,user):
        user.isReady = not user.isReady
        allReady = True
        # 告诉所有人这个人已经准备了。
        await self.notify_all_O({
                    "action": "ready",
                    "user": user.dic(),
                    "msg": ["玩家【"+user.name+"】"+("已准备" if user.isReady else "取消准备")]
                },"gameMsg")
        for u in self.users:
            allReady = allReady and u.isReady
        # 一个人不让他开始游戏
        if allReady and len(self.users) > 1:
            await self.nextRound(0)
        else:
            print("还有人未准备")

    async def userSetName(self,user):
        await self.notify_users(user,"userSetName")

    async def userEnter(self,user):
        # 有用户进入，取消移除群组监测
        if self.detectGroupHandler is not None:
            self.detectGroupHandler.cancel()
        await user.send(self.users_event_all())
        if user.group != None:
            await user.group().userLeave(user)
        user.setGroup(self)
        self.users.add(user)
        await self.notify_users(user,"users_enter")


    def checkGroupShouldRemove(self,loop):
        if len(self.users) == 0 and not self.isBaseGroup:
            Group.remove(self)
            # 移除后要通知大厅用户
            asyncio.run_coroutine_threadsafe(BaseGroup.notify_all(Group.group_list_event_all()),loop)

    async def userLeave(self,user):
        self.restore_user(user)
        if user in self.users:
            self.users.remove(user)
            # 判断房间里面还有没有用户，没有就移除房间
            if len(self.users) == 0 and not self.isBaseGroup:
                # 3秒后再次检测。
                if self.detectGroupHandler is not None:
                    self.detectGroupHandler.cancel()
                loop = asyncio.get_event_loop()
                self.detectGroupHandler = loop.call_later(2,self.checkGroupShouldRemove,loop)
            else:
                await self.notify_users(user,"users_out")


    async def dealGameStartMessage(self,user,msg):
        if not self.isBaseGroup and self.isStart and self.q_title is not None:
            # 如果游戏开始了。
            # 检查消息是否是答案，绘图者不进判断
            if msg == self.q_title and user is not self.current_user:
                # 答对了，如果是第一个+2分，如果是后面的+1分，并且绘图者+1分。
                if user not in self.q_correct_users:
                    if len(self.q_correct_users) == 0:
                        user.score += 2
                        u_msg = "【"+user.name+"】第一个猜对,+2分。"
                    else:
                        user.score += 1
                        u_msg = "【"+user.name+"】猜对了,+1分。"
                    self.current_user.score += 1
                    self.q_correct_users.append(user)
                    await self.notify_all_O({
                        "group": self.dic(),
                        "msg": [u_msg+"绘图者【"+self.current_user.name+"】+1分"]
                    },"gameMsg")
                # 判断是否全部人答对。全部人答对就下一轮
                if len(self.q_correct_users) == len(self.users)-1:
                    self.current_user.score += 1
                    await self.notify_all_O({
                        "group": self.dic(),
                        "msg": ["全部人都猜对了。绘图者【"+self.current_user.name+"】额外+1分。"]
                    },"gameMsg")
                    await self.nextRound(self.game_round)
                return True
            else:
                msg = msg.replace(self.q_title,"【答案勿说】")
                await self.notify_msg(user,msg)
                return True
        return False


    async def sendMessage(self,user,msg):
        # True 代表已经在判断中处理过了，不需要在发送了
        if not await self.dealGameStartMessage(user,msg):
            await self.notify_msg(user,msg)

    async def sendState(self,u_id,state):
        if not self.isBaseGroup:
            await self.notify_state_exclude(state,u_id)

    async def clearState(self,user):
        if not self.isBaseGroup:
            self.states = []
            await self.notify_state_clear(user.id)
            await self.sendMessage(user,"用户清空了画布")

BaseGroup = Group() # 基础群组，用来保存用户，群发消息
BaseGroup.name = "大厅"