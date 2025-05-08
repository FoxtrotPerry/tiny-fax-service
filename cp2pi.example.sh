bun package # make sure we're copying over the most up to date dist
scp -r $(pwd)/dist {user name}@{pi name}:/home/{user name}/tiny-fax
# ex: scp -r $(pwd)/dist perry@zero2w.local:/home/perry/tiny-fax