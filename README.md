# tiny-fax-service

To install dependencies:

```bash
bun install
```

To run:

```bash
bun dev
```

## Receipt printer special cases

Normally, your receipt printer will be connected to a switch or otherwise available to your network. But lets go over a few cases where you might need a different configuration.

### Pi connected directly to printer via ethernet

If your Raspberry Pi is connected directly to the printer via ethernet, you will need to set a static IP address on the Pi's ethernet interface. This is because the printer will not provide DHCP services, and the Pi will not be able to obtain an IP address automatically.

To do this, you'll need to know the default IP of the receipt printer you're using. This is typically `192.168.1.87`. Whence you know the default IP, you can run:

```bash
sudo ip addr add 192.168.1.87/24 dev eth0
```

After running this command, you should be able to ping the printer:

```bash
perry@pi5:~ $ ping 192.168.1.87
PING 192.168.1.87 (192.168.1.87) 56(84) bytes of data.
64 bytes from 192.168.1.87: icmp_seq=1 ttl=64 time=0.023 ms
64 bytes from 192.168.1.87: icmp_seq=2 ttl=64 time=0.033 ms
64 bytes from 192.168.1.87: icmp_seq=3 ttl=64 time=0.030 ms
64 bytes from 192.168.1.87: icmp_seq=4 ttl=64 time=0.026 ms
```
