/*
 *  Copyright (c) 2019 twinlife SA.
 *  SPDX-License-Identifier: AGPL-3.0-only
 *
 *  Contributors:
 *   Christian Jacquemot (Christian.Jacquemot@twin.life)
 */

/*
 * Derived from ByteArrayInputStream.java
 *  https://android.googlesource.com/platform/libcore (f8dfc9872ecc2f8c3cbc7cb747c2f010f14b3247)
 *  ojluni/src/main/java/java/io/ByteArrayInputStream.java
 */

/*
 * Copyright (c) 1994, 2013, Oracle and/or its affiliates. All rights reserved.
 * DO NOT ALTER OR REMOVE COPYRIGHT NOTICES OR THIS FILE HEADER.
 *
 * This code is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License version 2 only, as
 * published by the Free Software Foundation.  Oracle designates this
 * particular file as subject to the "Classpath" exception as provided
 * by Oracle in the LICENSE file that accompanied this code.
 *
 * This code is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License
 * version 2 for more details (a copy is included in the LICENSE file that
 * accompanied this code).
 *
 * You should have received a copy of the GNU General Public License version
 * 2 along with this work; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA.
 *
 * Please contact Oracle, 500 Oracle Parkway, Redwood Shores, CA 94065 USA
 * or visit www.oracle.com if you need additional information or have any
 * questions.
 */

/**
 * Creates <code>ByteArrayInputStream</code>
 * that uses <code>buf</code> as its
 * buffer array. The initial value of <code>pos</code>
 * is <code>offset</code> and the initial value
 * of <code>count</code> is the minimum of <code>offset+length</code>
 * and <code>buf.length</code>.
 * The buffer array is not copied. The buffer's mark is
 * set to the specified offset.
 *
 * @param   {Array} buf      the input buffer.
 * @param   {number} offset   the offset in the buffer of the first byte to read.
 * @param   {number} length   the maximum number of bytes to read from the buffer.
 * @class
 * @extends InputStream
 * @author  Arthur van Hoff
 */
export class ByteArrayInputStream {
	/**
	 * An array of bytes that was provided
	 * by the creator of the stream. Elements <code>buf[0]</code>
	 * through <code>buf[count-1]</code> are the
	 * only bytes that can ever be read from the
	 * stream;  element <code>buf[pos]</code> is
	 * the next byte to be read.
	 */
	buf: ArrayBuffer;

	/**
	 * The index of the next character to read from the input stream buffer.
	 * This value should always be nonnegative
	 * and not larger than the value of <code>count</code>.
	 * The next byte to be read from the input stream buffer
	 * will be <code>buf[pos]</code>.
	 */
	pos: number;

	/**
	 * The index one greater than the last valid character in the input
	 * stream buffer.
	 * This value should always be nonnegative
	 * and not larger than the length of <code>buf</code>.
	 * It  is one greater than the position of
	 * the last byte within <code>buf</code> that
	 * can ever be read  from the input stream buffer.
	 */
	count: number;

	public constructor(buf: ArrayBuffer) {
		this.buf = buf;
		this.pos = 0;
		this.count = buf.byteLength;
	}

	public read(): number {
		const srcBuffer: Uint8Array = new Uint8Array(this.buf, this.pos, 1);
		let value: number;
		if (this.pos < this.count) {
			value = srcBuffer[0] & 255;
			this.pos++;
		} else {
			value = -1;
		}
		return value;
	}

	public readBuffer(b: ArrayBuffer, off: number, len: number): number {
		if (this.pos >= this.count) {
			return -1;
		}
		const avail: number = this.count - this.pos;
		if (len > avail) {
			len = avail;
		}
		if (len <= 0) {
			return 0;
		}
		const srcBuffer: Uint8Array = new Uint8Array(this.buf, this.pos + off, len);
		const dstBuffer: Uint8Array = new Uint8Array(b, 0, len);
		dstBuffer.set(srcBuffer);
		this.pos += len;
		return len;
	}

	/**
	 * Skips <code>n</code> bytes of input from this input stream. Fewer
	 * bytes might be skipped if the end of the input stream is reached.
	 * The actual number <code>k</code>
	 * of bytes to be skipped is equal to the smaller
	 * of <code>n</code> and  <code>count-pos</code>.
	 * The value <code>k</code> is added into <code>pos</code>
	 * and <code>k</code> is returned.
	 *
	 * @param   {number} n   the number of bytes to be skipped.
	 * @return  {number} the actual number of bytes skipped.
	 */
	public skip(n: number): number {
		let k: number = this.count - this.pos;
		if (n < k) {
			k = n < 0 ? 0 : n;
		}
		this.pos += k;
		return k;
	}

	/**
	 * Returns the number of remaining bytes that can be read (or skipped over)
	 * from this input stream.
	 * <p>
	 * The value returned is <code>count&nbsp;- pos</code>,
	 * which is the number of bytes remaining to be read from the input buffer.
	 *
	 * @return  {number} the number of remaining bytes that can be read (or skipped
	 * over) from this input stream without blocking.
	 */
	public available(): number {
		return this.count - this.pos;
	}

	/**
	 * Closing a <tt>ByteArrayInputStream</tt> has no effect. The methods in
	 * this class can be called after the stream has been closed without
	 * generating an <tt>IOException</tt>.
	 */
	public close() {}
}
