export default function Avatar({ userId, username, online }) {
  const colors = [
    "bg-red-100",
    "bg-green-100",
    "bg-purple-100",
    "bg-pink-100",
    "bg-blue-100",
    "bg-yellow-100",
    "bg-gray-100",
    "bg-teal-100",
  ];
  const userIdBase10 = parseInt(userId.substring(10), 16);
  const colorIndex = userIdBase10 % colors.length;
  const color = colors[colorIndex];
  return (
    <div className={"w-8 h-8 relative rounded-full flex items-center " + color}>
      <div className="text-center w-full opacity-70">{username[0]}</div>
      {online && (
        <div className="absolute w-3 h-3 bg-green-600 bottom-0 right-0 rounded-full border border-white"></div>
      )}
      {!online && (
        <div className="absolute w-3 h-3 bg-gray-400 bottom-0 right-0 rounded-full border border-white"></div>
      )}
    </div>
  );
}
