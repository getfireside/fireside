all:
	 $(MAKE) -C client all
.PHONY: test

test:
	 $(MAKE) -C client test
	 $(MAKE) -C server test
		
